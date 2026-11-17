import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'
import { isDeliveryDay } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Towns live in lists:
//   - the master list (menu_id IS NULL) — the template the owner maintains
//   - one copy per delivery (menu_id = that delivery), taken from the master
//     list when the delivery is created, so editing one never changes another.

async function getActiveMenuId(): Promise<number | null> {
  const [row] = await sql`SELECT id FROM menus WHERE is_active = true LIMIT 1`
  return row ? (row.id as number) : null
}

// GET /api/villages                 — active towns of the active delivery. Public.
// GET /api/villages?all=1           — every town of the active delivery. Manager.
// GET /api/villages?list=master     — every town on the master list. Manager.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  if (params.get('list') === 'master') {
    if (!checkRequestPin(req, 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await sql`
      SELECT id, name, pickup_time, delivery_day, sort_order, is_active
      FROM villages
      WHERE menu_id IS NULL
      ORDER BY CASE delivery_day WHEN 'Thursday' THEN 1 WHEN 'Friday' THEN 2 WHEN 'Saturday' THEN 3 WHEN 'Sunday' THEN 4 ELSE 5 END, sort_order ASC, lower(name) ASC
    `
    return NextResponse.json(rows)
  }

  const menuId = await getActiveMenuId()
  if (!menuId) return NextResponse.json([])

  if (params.get('all') === '1') {
    if (!checkRequestPin(req, 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await sql`
      SELECT id, name, pickup_time, delivery_day, sort_order, is_active
      FROM villages
      WHERE menu_id = ${menuId}
      ORDER BY CASE delivery_day WHEN 'Thursday' THEN 1 WHEN 'Friday' THEN 2 WHEN 'Saturday' THEN 3 WHEN 'Sunday' THEN 4 ELSE 5 END, sort_order ASC, lower(name) ASC
    `
    return NextResponse.json(rows)
  }

  const rows = await sql`
    SELECT id, name, pickup_time, delivery_day, sort_order, is_active
    FROM villages
    WHERE is_active = true AND menu_id = ${menuId}
    ORDER BY CASE delivery_day WHEN 'Thursday' THEN 1 WHEN 'Friday' THEN 2 WHEN 'Saturday' THEN 3 WHEN 'Sunday' THEN 4 ELSE 5 END, sort_order ASC, lower(name) ASC
  `
  return NextResponse.json(rows)
}

function normalizeDay(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (isDeliveryDay(v)) return v
  return v ? v : ''
}

// POST /api/villages — add a town to the master list ({ list: 'master' })
// or to the active delivery (default). Manager only.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    pickup_time?: string
    delivery_day?: string
    list?: string
  }
  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const isMaster = body.list === 'master'
  const menuId = isMaster ? null : await getActiveMenuId()
  if (!isMaster && !menuId) {
    return NextResponse.json(
      { error: 'There is no active delivery to add this town to' },
      { status: 400 },
    )
  }

  const [{ next_sort }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM villages
    WHERE menu_id IS NOT DISTINCT FROM ${menuId}
  `
  const [village] = await sql`
    INSERT INTO villages (name, pickup_time, delivery_day, sort_order, menu_id)
    VALUES (${name}, ${(body.pickup_time ?? '').trim()}, ${normalizeDay(body.delivery_day) ?? 'Friday'}, ${next_sort}, ${menuId})
    RETURNING id, name, pickup_time, delivery_day, sort_order, is_active
  `
  return NextResponse.json(village, { status: 201 })
}

// PATCH /api/villages — edit name / time / day / active flag. Manager only.
export async function PATCH(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    name?: string
    pickup_time?: string
    delivery_day?: string
    is_active?: boolean
  }
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const [village] = await sql`
    UPDATE villages SET
      name = COALESCE(${body.name ?? null}, name),
      pickup_time = COALESCE(${body.pickup_time ?? null}, pickup_time),
      delivery_day = COALESCE(${normalizeDay(body.delivery_day)}, delivery_day),
      is_active = COALESCE(${body.is_active ?? null}, is_active)
    WHERE id = ${body.id}
    RETURNING id, name, pickup_time, delivery_day, sort_order, is_active
  `
  if (!village) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(village)
}

// DELETE /api/villages?id=123 — remove a town. Manager only.
// Past orders keep their village_id nulled so history is preserved.
export async function DELETE(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  await sql`UPDATE orders SET village_id = NULL WHERE village_id = ${id}`
  await sql`DELETE FROM villages WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
