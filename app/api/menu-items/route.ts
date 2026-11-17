import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'

export const dynamic = 'force-dynamic'

// GET /api/menu-items?menuId=123 (defaults to active menu). Public read.
// GET /api/menu-items?catalog=true — reusable product catalog for the picker.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('catalog') === 'true') {
    const catalog = await sql`
      SELECT name, category, price_cents, description, is_seasonal
      FROM products
      ORDER BY category, lower(name)
    `
    return NextResponse.json({ catalog })
  }

  const menuIdParam = req.nextUrl.searchParams.get('menuId')
  let menuId: number | null = menuIdParam ? Number(menuIdParam) : null
  if (!menuId) {
    const [active] = await sql`SELECT id FROM menus WHERE is_active = true ORDER BY id DESC LIMIT 1`
    menuId = active ? (active.id as number) : null
  }

  if (!menuId) return NextResponse.json({ menuId: null, items: [] })

  const items = await sql`
    SELECT id, menu_id, category, name, description, price_cents, sort_order, is_seasonal, is_sold_out
    FROM menu_items
    WHERE menu_id = ${menuId}
    ORDER BY sort_order ASC, id ASC
  `
  return NextResponse.json({ menuId, items })
}

// POST /api/menu-items — add an item. Manager only.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    menu_id?: number
    category?: string
    name?: string
    description?: string
    price_cents?: number
    sort_order?: number
    is_seasonal?: boolean
  }
  if (!body.menu_id || !body.name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const price = Math.max(0, Math.round(Number(body.price_cents) || 0))
  const category = (body.category ?? '').trim()
  const description = (body.description ?? '').trim()
  const isSeasonal = Boolean(body.is_seasonal)

  const [{ next_sort }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort
    FROM menu_items WHERE menu_id = ${body.menu_id}
  `

  const [item] = await sql`
    INSERT INTO menu_items (menu_id, category, name, description, price_cents, sort_order, is_seasonal)
    VALUES (${body.menu_id}, ${category}, ${body.name.trim()}, ${description}, ${price}, ${body.sort_order ?? next_sort}, ${isSeasonal})
    RETURNING id, menu_id, category, name, description, price_cents, sort_order, is_seasonal, is_sold_out
  `

  // Keep the persistent catalog in sync so this product is reusable next time.
  await sql`
    INSERT INTO products (name, category, price_cents, description, is_seasonal)
    VALUES (${body.name.trim()}, ${category}, ${price}, ${description}, ${isSeasonal})
    ON CONFLICT (name) DO UPDATE
      SET category = EXCLUDED.category,
          price_cents = EXCLUDED.price_cents,
          is_seasonal = EXCLUDED.is_seasonal,
          description = CASE WHEN EXCLUDED.description <> '' THEN EXCLUDED.description ELSE products.description END
  `
  return NextResponse.json(item, { status: 201 })
}

// PATCH /api/menu-items — edit a delivery's menu item (by id).
// PATCH /api/menu-items with { catalog: true, originalName, ... } — edit a
// reusable catalog product in place. Manager only.
export async function PATCH(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    catalog?: boolean
    originalName?: string
    category?: string
    name?: string
    description?: string
    price_cents?: number
    is_seasonal?: boolean
    sold_out?: boolean
  }

  // { id, sold_out } on its own only flips the sold-out flag.
  if (body.id && typeof body.sold_out === 'boolean' && body.name === undefined) {
    const [item] = await sql`
      UPDATE menu_items SET is_sold_out = ${body.sold_out}
      WHERE id = ${body.id}
      RETURNING id, menu_id, category, name, description, price_cents, sort_order, is_seasonal, is_sold_out
    `
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(item)
  }

  if (body.catalog) {
    const originalName = (body.originalName ?? '').trim()
    const name = (body.name ?? '').trim()
    if (!originalName || !name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }
    const price = Math.max(0, Math.round(Number(body.price_cents) || 0))
    const category = (body.category ?? '').trim()
    const description = (body.description ?? '').trim()
    try {
      const [product] = await sql`
        UPDATE products
        SET name = ${name}, category = ${category}, price_cents = ${price}, description = ${description}, is_seasonal = ${Boolean(body.is_seasonal)}
        WHERE lower(name) = lower(${originalName})
        RETURNING name, category, price_cents, description, is_seasonal
      `
      if (!product) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(product)
    } catch {
      // Unique-name violation when renaming onto an existing product.
      return NextResponse.json(
        { error: `A product named "${name}" already exists.` },
        { status: 409 },
      )
    }
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  const price = Math.max(0, Math.round(Number(body.price_cents) || 0))
  const [item] = await sql`
    UPDATE menu_items
    SET category = ${(body.category ?? '').trim()},
        name = ${(body.name ?? '').trim()},
        description = ${(body.description ?? '').trim()},
        price_cents = ${price},
        is_seasonal = ${Boolean(body.is_seasonal)}
    WHERE id = ${body.id}
    RETURNING id, menu_id, category, name, description, price_cents, sort_order, is_seasonal, is_sold_out
  `
  return NextResponse.json(item)
}

// DELETE /api/menu-items?id=123 — remove an item from a delivery's menu.
// DELETE /api/menu-items?catalog=true&name=Foo — permanently remove a product
// from the reusable catalog (products). Manager only.
export async function DELETE(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (req.nextUrl.searchParams.get('catalog') === 'true') {
    const name = (req.nextUrl.searchParams.get('name') ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }
    await sql`DELETE FROM products WHERE lower(name) = lower(${name})`
    return NextResponse.json({ ok: true })
  }

  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  await sql`DELETE FROM menu_items WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
