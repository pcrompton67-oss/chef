import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'

export const dynamic = 'force-dynamic'

// GET /api/menus — list all deliveries (newest first). Public read.
export async function GET() {
  const menus = await sql`
    SELECT id, name, sale_date, sale_date_end, cutoff_at, orders_open, is_active
    FROM menus
    ORDER BY id DESC
  `
  return NextResponse.json(menus)
}

// POST /api/menus — create a delivery and make it the active one. Manager only.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    sale_date?: string | null
    sale_date_end?: string | null
    cutoff_at?: string | null
    orders_open?: boolean
    activate?: boolean
  }
  const name = (body.name ?? '').trim()
  const activate = body.activate !== false
  const saleDate = normalizeDate(body.sale_date)
  const saleDateEnd = normalizeDate(body.sale_date_end)
  const cutoffAt = normalizeInstant(body.cutoff_at)

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (activate) {
    await sql`UPDATE menus SET is_active = false WHERE is_active = true`
  }

  // New deliveries start with ordering switched off so the owner can build the
  // menu before customers can order.
  const [menu] = await sql`
    INSERT INTO menus (name, sale_date, sale_date_end, cutoff_at, orders_open, is_active)
    VALUES (${name}, ${saleDate}, ${saleDateEnd}, ${cutoffAt}, ${body.orders_open ?? false}, ${activate})
    RETURNING id, name, sale_date, sale_date_end, cutoff_at, orders_open, is_active
  `

  // Snapshot the master drop-off list for this delivery, so later edits to
  // either list stay independent.
  await sql`
    INSERT INTO villages (name, pickup_time, sort_order, is_active, delivery_day, menu_id)
    SELECT name, pickup_time, sort_order, is_active, delivery_day, ${menu.id}
    FROM villages WHERE menu_id IS NULL
    ORDER BY sort_order, id
  `
  return NextResponse.json(menu, { status: 201 })
}

// PATCH /api/menus — activate, rename, or set dates / cutoff. Manager only.
export async function PATCH(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    name?: string
    sale_date?: string | null
    sale_date_end?: string | null
    cutoff_at?: string | null
    orders_open?: boolean
    activate?: boolean
  }
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  if (body.activate === true) {
    await sql`UPDATE menus SET is_active = false WHERE is_active = true`
    const [menu] = await sql`
      UPDATE menus SET is_active = true WHERE id = ${body.id}
      RETURNING id, name, sale_date, sale_date_end, cutoff_at, orders_open, is_active
    `
    return NextResponse.json(menu)
  }

  // Field updates: only touch keys that were provided.
  const name = typeof body.name === 'string' ? body.name.trim() : null
  const saleProvided = 'sale_date' in body
  const saleEndProvided = 'sale_date_end' in body
  const cutoffProvided = 'cutoff_at' in body
  const openProvided = typeof body.orders_open === 'boolean'
  const saleDate = saleProvided ? normalizeDate(body.sale_date) : null
  const saleDateEnd = saleEndProvided ? normalizeDate(body.sale_date_end) : null
  const cutoffAt = cutoffProvided ? normalizeInstant(body.cutoff_at) : null

  const [menu] = await sql`
    UPDATE menus SET
      name = COALESCE(${name}, name),
      sale_date = CASE WHEN ${saleProvided} THEN ${saleDate} ELSE sale_date END,
      sale_date_end = CASE WHEN ${saleEndProvided} THEN ${saleDateEnd} ELSE sale_date_end END,
      cutoff_at = CASE WHEN ${cutoffProvided} THEN ${cutoffAt} ELSE cutoff_at END,
      orders_open = CASE WHEN ${openProvided} THEN ${body.orders_open ?? false} ELSE orders_open END
    WHERE id = ${body.id}
    RETURNING id, name, sale_date, sale_date_end, cutoff_at, orders_open, is_active
  `
  return NextResponse.json(menu)
}

// DELETE /api/menus?id=123 — remove a delivery. Manager only.
// Preserves past orders by nulling their menu_id.
export async function DELETE(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  try {
    await sql`UPDATE orders SET menu_id = NULL WHERE menu_id = ${id}`
    await sql`DELETE FROM menu_items WHERE menu_id = ${id}`
    await sql`DELETE FROM menus WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  // Expecting YYYY-MM-DD from an <input type="date">.
  return value.trim()
}

function normalizeInstant(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}
