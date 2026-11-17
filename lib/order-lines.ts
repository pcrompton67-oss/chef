import { sql } from '@/lib/db'
import {
  flavourLabel,
  isMeatFlavour,
  isSausageMeat,
  lineKey,
} from '@/lib/types'

export type RequestedLine = {
  menu_item_id: number
  quantity: number
  flavour_item_id?: number | null
}

export type CleanLine = {
  menu_item_id: number
  flavour_item_id: number | null
  quantity: number
  // Snapshot for emails, e.g. "Sausage meat – Porky".
  item: { name: string; price_cents: number }
}

type Row = {
  id: number
  name: string
  category: string
  price_cents: number
  is_sold_out: boolean
}

// Checks requested lines against a delivery's menu. Sausage meat must name a
// sausage flavour from the same menu. When `forCustomer` is set, sold-out
// items or flavours are rejected and a flavour is mandatory; the manager may
// still save older sausage-meat lines that have no flavour.
export async function resolveOrderLines(
  menuId: number,
  requested: RequestedLine[],
  forCustomer: boolean,
): Promise<{ lines: CleanLine[] } | { error: string }> {
  const wanted = requested.filter(
    (i) => i && Number(i.menu_item_id) > 0 && Number(i.quantity) > 0,
  )
  const ids = new Set<number>()
  for (const i of wanted) {
    ids.add(Number(i.menu_item_id))
    if (Number(i.flavour_item_id) > 0) ids.add(Number(i.flavour_item_id))
  }
  if (ids.size === 0) return { lines: [] }

  const rows = (await sql`
    SELECT id, name, category, price_cents, is_sold_out FROM menu_items
    WHERE menu_id = ${menuId} AND id = ANY(${[...ids]})
  `) as Row[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  const merged = new Map<string, CleanLine>()
  const soldOut = new Set<string>()
  for (const i of wanted) {
    const item = byId.get(Number(i.menu_item_id))
    if (!item) continue

    let flavour: Row | null = null
    if (isSausageMeat(item)) {
      const f = byId.get(Number(i.flavour_item_id))
      if (f && isMeatFlavour(f)) flavour = f
      else if (forCustomer || Number(i.flavour_item_id) > 0) {
        return { error: 'Please choose a flavour for your sausage meat.' }
      }
    }

    if (forCustomer) {
      if (item.is_sold_out) soldOut.add(item.name)
      else if (flavour?.is_sold_out) soldOut.add(`${flavourLabel(flavour.name)} sausage meat`)
    }

    const quantity = Math.min(99, Math.max(1, Math.round(Number(i.quantity))))
    const key = lineKey(item.id, flavour?.id)
    const existing = merged.get(key)
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity)
      continue
    }
    merged.set(key, {
      menu_item_id: item.id,
      flavour_item_id: flavour?.id ?? null,
      quantity,
      item: {
        name: flavour ? `${item.name} – ${flavourLabel(flavour.name)}` : item.name,
        price_cents: item.price_cents,
      },
    })
  }

  if (soldOut.size > 0) {
    const names = [...soldOut]
    const one = names.length === 1
    return {
      error: `Sorry, ${names.join(', ')} ${one ? 'has' : 'have'} just sold out. Please remove ${one ? 'it' : 'them'} and try again.`,
    }
  }
  return { lines: [...merged.values()] }
}
