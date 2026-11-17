import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'

export const dynamic = 'force-dynamic'

// PATCH /api/order-items — mark lines as allocated from stock (or made). Manager PIN.
// { id, is_allocated } ticks a single line on one order.
// { menu_item_id, is_allocated } ticks that product on every order (menu items
// belong to a single delivery's menu, so this stays within one delivery).
export async function PATCH(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    menu_item_id?: number
    flavour_item_id?: number | null
    is_allocated?: boolean
  }
  if (typeof body.is_allocated !== 'boolean') {
    return NextResponse.json({ error: 'is_allocated is required' }, { status: 400 })
  }

  const lineId = Number(body.id) || 0
  const menuItemId = Number(body.menu_item_id) || 0

  if (lineId) {
    await sql`UPDATE order_items SET is_allocated = ${body.is_allocated} WHERE id = ${lineId}`
  } else if (menuItemId && 'flavour_item_id' in body) {
    // Sausage meat is made per flavour, so only tick that flavour's lines.
    const flavourId = Number(body.flavour_item_id) || null
    await sql`
      UPDATE order_items SET is_allocated = ${body.is_allocated}
      WHERE menu_item_id = ${menuItemId} AND flavour_item_id IS NOT DISTINCT FROM ${flavourId}
    `
  } else if (menuItemId) {
    await sql`
      UPDATE order_items SET is_allocated = ${body.is_allocated}
      WHERE menu_item_id = ${menuItemId}
    `
  } else {
    return NextResponse.json({ error: 'id or menu_item_id is required' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
