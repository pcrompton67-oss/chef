// Spotting customers who have ordered more than once for the same delivery.
// Pure helpers, safe to use on both the server and in the browser.

export type DuplicateKind = 'identical' | 'possible'

type Line = {
  menu_item_id: number
  flavour_item_id?: number | null
  quantity: number
}

type OrderLike = {
  id: number
  customer_name: string
  email: string | null
  items: Line[]
}

export function normaliseEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function normaliseName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

// Same person: same email (when both have one), or same name.
export function samePerson(
  a: { customer_name: string; email: string | null },
  b: { customer_name: string; email: string | null },
): boolean {
  const ea = normaliseEmail(a.email)
  const eb = normaliseEmail(b.email)
  if (ea && eb && ea === eb) return true
  const na = normaliseName(a.customer_name)
  return na !== '' && na === normaliseName(b.customer_name)
}

// A fingerprint of what's in an order: each item (and meat flavour) with its
// total quantity, sorted, so the same basket always gives the same string.
export function basketKey(items: Line[]): string {
  const totals = new Map<string, number>()
  for (const it of items) {
    const key = `${it.menu_item_id}:${it.flavour_item_id ?? ''}`
    totals.set(key, (totals.get(key) ?? 0) + Number(it.quantity))
  }
  return Array.from(totals.entries())
    .filter(([, q]) => q > 0)
    .map(([k, q]) => `${k}x${q}`)
    .sort()
    .join('|')
}

// How an order compares with other orders from the same person:
// 'identical' if any of them has exactly the same items, otherwise 'possible'.
// Returns null when there are no other orders from that person.
export function compareWithOthers(
  order: Omit<OrderLike, 'id'>,
  others: OrderLike[],
): DuplicateKind | null {
  const mine = others.filter((o) => samePerson(order, o))
  if (mine.length === 0) return null
  const key = basketKey(order.items)
  return mine.some((o) => basketKey(o.items) === key) ? 'identical' : 'possible'
}

// For the Orders tab: which orders on this delivery are repeats, by order id.
export function findDuplicates(orders: OrderLike[]): Map<number, DuplicateKind> {
  const result = new Map<number, DuplicateKind>()
  for (const o of orders) {
    const kind = compareWithOthers(
      o,
      orders.filter((x) => x.id !== o.id),
    )
    if (kind) result.set(o.id, kind)
  }
  return result
}
