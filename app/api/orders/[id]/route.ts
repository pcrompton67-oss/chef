import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'
import { sendOrderConfirmation } from '@/lib/email'
import { resolveOrderLines, type RequestedLine } from '@/lib/order-lines'
import { lineKey } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SOURCES = ['website', 'email', 'messenger', 'phone', 'in_person'] as const
type Source = (typeof SOURCES)[number]

// PATCH /api/orders/[id] — the owner edits an existing order (e.g. a customer
// emailed a change). Replaces details and line items. Manager PIN. No cutoff
// check, since changes are often agreed after ordering closes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orderId = Number(id)
  if (!orderId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    customer_name?: string
    email?: string
    village_id?: number
    notes?: string
    is_new_customer?: boolean
    source?: string
    send_confirmation?: boolean
    items?: RequestedLine[]
  }

  const [existing] = await sql`
    SELECT id, menu_id, village_id, source, is_new_customer FROM orders WHERE id = ${orderId}
  `
  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // The tick box on an order card sends just the flag; leave everything else alone.
  if (body.items === undefined && typeof body.is_new_customer === 'boolean') {
    await sql`
      UPDATE orders SET is_new_customer = ${body.is_new_customer} WHERE id = ${orderId}
    `
    return NextResponse.json({ ok: true })
  }
  const isNewCustomer =
    typeof body.is_new_customer === 'boolean'
      ? body.is_new_customer
      : (existing.is_new_customer as boolean)

  const name = (body.customer_name ?? '').trim()
  const email = (body.email ?? '').trim()
  const notes = (body.notes ?? '').trim()
  const villageId = Number(body.village_id) || 0
  const source: Source = SOURCES.includes(body.source as Source)
    ? (body.source as Source)
    : (existing.source as Source)
  const items = (body.items ?? []).filter(
    (i) => i && Number(i.menu_item_id) > 0 && Number(i.quantity) > 0,
  )

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'That email address does not look right' },
      { status: 400 },
    )
  }
  if (!villageId) {
    return NextResponse.json(
      { error: 'Please choose a drop-off town' },
      { status: 400 },
    )
  }
  if (items.length === 0) {
    return NextResponse.json(
      { error: 'An order needs at least one item — delete it instead' },
      { status: 400 },
    )
  }

  // Keep the order's current town valid even if it has since been switched off.
  const [village] = await sql`
    SELECT id, name, pickup_time, delivery_day FROM villages
    WHERE id = ${villageId}
      AND (
        (is_active = true AND menu_id = ${existing.menu_id as number | null})
        OR id = ${existing.village_id as number | null}
      )
  `
  if (!village) {
    return NextResponse.json(
      { error: 'That drop-off town is unavailable' },
      { status: 400 },
    )
  }

  const menuId = existing.menu_id as number
  const resolved = await resolveOrderLines(menuId, items, false)
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

  await sql`
    UPDATE orders
    SET customer_name = ${name}, email = ${email}, village_id = ${villageId},
        notes = ${notes}, source = ${source}, is_new_customer = ${isNewCustomer}
    WHERE id = ${orderId}
  `
  // A line stays ticked only if the same item and quantity are still on the order;
  // a changed quantity needs re-checking against stock.
  const previous = await sql`
    SELECT menu_item_id, flavour_item_id, quantity FROM order_items
    WHERE order_id = ${orderId} AND is_allocated = true
  `
  const allocatedQty = new Map(
    previous.map((p) => [
      lineKey(p.menu_item_id as number, p.flavour_item_id as number | null),
      p.quantity as number,
    ]),
  )
  await sql`DELETE FROM order_items WHERE order_id = ${orderId}`
  for (const i of cleanItems) {
    const keepTick =
      allocatedQty.get(lineKey(i.menu_item_id, i.flavour_item_id)) === i.quantity
    await sql`
      INSERT INTO order_items (order_id, menu_item_id, quantity, is_allocated, flavour_item_id)
      VALUES (${orderId}, ${i.menu_item_id}, ${i.quantity}, ${keepTick}, ${i.flavour_item_id})
    `
  }

  if (body.send_confirmation === true && email) {
    const [menu] = await sql`
      SELECT name, sale_date, sale_date_end FROM menus WHERE id = ${menuId}
    `
    await sendOrderConfirmation({
      to: email,
      customerName: name,
      menu: {
        name: (menu?.name as string) ?? '',
        sale_date: (menu?.sale_date as string | null) ?? null,
        sale_date_end: (menu?.sale_date_end as string | null) ?? null,
      },
      village: {
        name: village.name as string,
        pickup_time: village.pickup_time as string,
        delivery_day: village.delivery_day as string,
      },
      lines: cleanItems.map((i) => ({ item: i.item, quantity: i.quantity })),
      notes,
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/orders/[id] — permanently remove an order + its items. Manager PIN.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orderId = Number(id)
  if (!orderId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  await sql`DELETE FROM order_items WHERE order_id = ${orderId}`
  await sql`DELETE FROM orders WHERE id = ${orderId}`
  return NextResponse.json({ ok: true })
}
