import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'
import { sendOrderConfirmation, sendOwnerNotification } from '@/lib/email'
import { resolveOrderLines, type RequestedLine } from '@/lib/order-lines'
import {
  compareWithOthers,
  normaliseEmail,
  samePerson,
  type DuplicateKind,
} from '@/lib/duplicates'
import {
  touchCustomerWithoutConsent,
  upsertCustomerFromOrder,
} from '@/features/customers/lib'

export const dynamic = 'force-dynamic'

// GET /api/orders?menuId=123  — all orders for a menu (defaults to active).
// Manager only. Powers the owner's Orders view, product totals and delivery run.
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const menuIdParam = req.nextUrl.searchParams.get('menuId')
  let menuId: number | null = menuIdParam ? Number(menuIdParam) : null
  if (!menuId) {
    const [active] = await sql`
      SELECT id FROM menus WHERE is_active = true ORDER BY id DESC LIMIT 1
    `
    menuId = active ? (active.id as number) : null
  }
  if (!menuId) return NextResponse.json({ menuId: null, orders: [] })

  const orders = await sql`
    SELECT o.id, o.menu_id, o.village_id, o.customer_name, o.email, o.notes,
           o.is_new_customer, o.source, o.created_at, v.name AS village_name, v.pickup_time, v.delivery_day
    FROM orders o
    LEFT JOIN villages v ON v.id = o.village_id
    WHERE o.menu_id = ${menuId}
    ORDER BY o.created_at ASC
  `
  return NextResponse.json({ menuId, orders: await withItems(orders) })
}

// Attaches line items (name + price + quantity) to each order.
async function withItems(orders: Record<string, unknown>[]) {
  if (orders.length === 0) return []
  const ids = orders.map((o) => o.id as number)
  const items = await sql`
    SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.is_allocated,
           oi.flavour_item_id, f.name AS flavour_name, mi.name, mi.price_cents
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    LEFT JOIN menu_items f ON f.id = oi.flavour_item_id
    WHERE oi.order_id = ANY(${ids})
    ORDER BY oi.id ASC
  `
  const byOrder = new Map<number, unknown[]>()
  for (const it of items) {
    const arr = byOrder.get(it.order_id as number) ?? []
    arr.push(it)
    byOrder.set(it.order_id as number, arr)
  }
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id as number) ?? [] }))
}

const MANUAL_SOURCES = ['email', 'messenger', 'phone', 'in_person'] as const
type ManualSource = (typeof MANUAL_SOURCES)[number]

// POST /api/orders — a customer places a weekly pre-order. Public.
// Requires name, email, village, and at least one item. Enforces the cutoff.
//
// With a valid manager PIN the same endpoint records a manual order (taken by
// email, Messenger, phone or in person): the open/cutoff checks are skipped,
// email becomes optional, and a confirmation is only sent when asked for.
export async function POST(req: NextRequest) {
  const isManager = checkRequestPin(req, 'manager')
  const body = (await req.json().catch(() => ({}))) as {
    customer_name?: string
    email?: string
    village_id?: number
    notes?: string
    marketing_consent?: boolean
    is_new_customer?: boolean
    source?: string
    send_confirmation?: boolean
    // The customer has seen the "you've already ordered" warning and wants to go ahead.
    confirm_duplicate?: boolean
    items?: RequestedLine[]
  }

  const name = (body.customer_name ?? '').trim()
  const email = (body.email ?? '').trim()
  const notes = (body.notes ?? '').trim()
  const marketingConsent = body.marketing_consent === true
  const villageId = Number(body.village_id) || 0
  const items = (body.items ?? []).filter(
    (i) => i && Number(i.menu_item_id) > 0 && Number(i.quantity) > 0,
  )
  const source: ManualSource | 'website' =
    isManager && MANUAL_SOURCES.includes(body.source as ManualSource)
      ? (body.source as ManualSource)
      : 'website'
  const sendConfirmation = isManager ? body.send_confirmation === true : true
  const isNewCustomer = isManager && body.is_new_customer === true

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  // Customers must give an email; a manager may leave it blank for someone
  // who ordered by Messenger or phone, but anything entered must be valid.
  if (!isManager && !emailLooksValid) {
    return NextResponse.json(
      { error: 'A valid email is required' },
      { status: 400 },
    )
  }
  if (isManager && email && !emailLooksValid) {
    return NextResponse.json(
      { error: 'That email address does not look right' },
      { status: 400 },
    )
  }
  if (!villageId) {
    return NextResponse.json(
      { error: 'Please choose a pickup village' },
      { status: 400 },
    )
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Your order is empty' }, { status: 400 })
  }

  // Active menu + owner switch + cutoff enforcement.
  const [active] = await sql`
    SELECT id, name, sale_date, sale_date_end, cutoff_at, orders_open
    FROM menus WHERE is_active = true ORDER BY id DESC LIMIT 1
  `
  if (!active) {
    return NextResponse.json(
      { error: 'Ordering is not open yet' },
      { status: 400 },
    )
  }
  if (!isManager && active.orders_open === false) {
    return NextResponse.json(
      { error: 'Ordering is not open yet for this delivery' },
      { status: 400 },
    )
  }
  if (
    !isManager &&
    active.cutoff_at &&
    new Date(active.cutoff_at as string).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: 'Ordering has closed for this delivery' },
      { status: 400 },
    )
  }
  const menuId = active.id as number

  // The village must exist and be active.
  const [village] = await sql`
    SELECT id, name, pickup_time, delivery_day FROM villages
    WHERE id = ${villageId} AND is_active = true AND menu_id = ${menuId}
  `
  if (!village) {
    return NextResponse.json(
      { error: 'That drop-off town is unavailable' },
      { status: 400 },
    )
  }

  // Validate items against the active menu and snapshot names/prices for email.
  const resolved = await resolveOrderLines(menuId, items, !isManager)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }
  const cleanItems = resolved.lines
  if (cleanItems.length === 0) {
    return NextResponse.json(
      { error: 'No valid items on this delivery\u2019s menu' },
      { status: 400 },
    )
  }

  // Has this person already ordered for this delivery?
  const duplicate = await findRepeat(menuId, name, email, cleanItems)
  // Website customers are warned (matched on email only) and must confirm.
  // The reply says nothing about the earlier order itself.
  if (!isManager && duplicate?.sameEmail && body.confirm_duplicate !== true) {
    return NextResponse.json({ duplicate: true }, { status: 409 })
  }

  const [order] = await sql`
    INSERT INTO orders (menu_id, village_id, customer_name, email, notes, source, is_new_customer)
    VALUES (${menuId}, ${villageId}, ${name}, ${email}, ${notes}, ${source}, ${isNewCustomer})
    RETURNING id
  `
  const orderId = order.id as number

  for (const i of cleanItems) {
    await sql`
      INSERT INTO order_items (order_id, menu_item_id, quantity, flavour_item_id)
      VALUES (${orderId}, ${i.menu_item_id}, ${i.quantity}, ${i.flavour_item_id})
    `
  }

  // Keep the customer list up to date. Only a ticked box grants email consent.
  // Nothing to record when a manual order has no email.
  if (email) {
    if (marketingConsent) {
      await upsertCustomerFromOrder({ name, email })
    } else {
      await touchCustomerWithoutConsent({ name, email })
    }
  }

  const emailDetails = {
    to: email,
    customerName: name,
    menu: {
      name: active.name as string,
      sale_date: active.sale_date as string | null,
      sale_date_end: active.sale_date_end as string | null,
    },
    village: {
      name: village.name as string,
      pickup_time: village.pickup_time as string,
      delivery_day: village.delivery_day as string,
    },
    lines: cleanItems.map((i) => ({ item: i.item, quantity: i.quantity })),
    notes,
  }

  // Customer confirmation and owner alert go out together; neither can fail the order.
  await Promise.all([
    sendConfirmation && email
      ? sendOrderConfirmation(emailDetails)
      : Promise.resolve({ sent: false }),
    source === 'website'
      ? sendOwnerNotification({
          ...emailDetails,
          orderId,
          duplicate: duplicate?.kind ?? null,
        })
      : Promise.resolve({ sent: false }),
  ])

  return NextResponse.json({ id: orderId }, { status: 201 })
}

// Looks for earlier orders on this delivery from the same person (same email,
// or same name). Returns null if there are none.
async function findRepeat(
  menuId: number,
  name: string,
  email: string,
  lines: { menu_item_id: number; flavour_item_id: number | null; quantity: number }[],
): Promise<{ kind: DuplicateKind; sameEmail: boolean } | null> {
  const rows = await sql`
    SELECT id, customer_name, email FROM orders WHERE menu_id = ${menuId}
  `
  const me = { customer_name: name, email }
  const matches = rows
    .map((r) => ({
      id: r.id as number,
      customer_name: r.customer_name as string,
      email: (r.email as string | null) ?? '',
    }))
    .filter((r) => samePerson(me, r))
  if (matches.length === 0) return null

  const ids = matches.map((m) => m.id)
  const items = await sql`
    SELECT order_id, menu_item_id, flavour_item_id, quantity
    FROM order_items WHERE order_id = ANY(${ids})
  `
  const others = matches.map((m) => ({
    ...m,
    items: items
      .filter((it) => it.order_id === m.id)
      .map((it) => ({
        menu_item_id: it.menu_item_id as number,
        flavour_item_id: it.flavour_item_id as number | null,
        quantity: it.quantity as number,
      })),
  }))
  const kind = compareWithOthers({ ...me, items: lines }, others)
  if (!kind) return null
  const myEmail = normaliseEmail(email)
  const sameEmail =
    myEmail !== '' && matches.some((m) => normaliseEmail(m.email) === myEmail)
  return { kind, sameEmail }
}
