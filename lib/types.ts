// Domain types for Magnificent Sausage Rolls & Sausages' fortnightly
// pre-order delivery run.

import { dateLocale, rangeJoiners, type Locale } from './i18n'

// A fixed, reusable drop-off town. The owner maintains this list; customers
// choose one when ordering, and the delivery run is grouped by it.
export type Village = {
  id: number
  name: string
  // Free-text drop-off time shown to customers, e.g. "09:45". Also used to
  // order the delivery run.
  pickup_time: string
  // Which day of the run this town is on: one of DELIVERY_DAYS.
  delivery_day: string
  sort_order: number
  is_active: boolean
}

// A single fortnight's delivery. Exactly one menu is active at a time.
export type Menu = {
  id: number
  name: string
  // The Friday the run starts (YYYY-MM-DD), or null if not set yet.
  sale_date: string | null
  // The Saturday the run finishes (YYYY-MM-DD), or null for a single day.
  sale_date_end: string | null
  // Absolute instant after which ordering closes, or null for always open.
  cutoff_at: string | null
  // Owner-controlled master switch. When false the public site shows a
  // "opening soon" notice instead of the order form, regardless of cutoff.
  orders_open: boolean
  is_active: boolean
}

export type MenuItem = {
  id: number
  menu_id: number
  category: string
  name: string
  description: string
  price_cents: number
  sort_order: number
  // Marks limited-run flavours so they get a "Seasonal" tag on the menu.
  is_seasonal: boolean
  // Still shown on the menu, but customers can no longer order it.
  is_sold_out: boolean
}

export type OrderItem = {
  id: number
  order_id: number
  menu_item_id: number
  quantity: number
  name: string
  price_cents: number
  // Ticked once Bob has it (from stock or freshly made) set aside for this order.
  is_allocated: boolean
  // For sausage meat: which sausage flavour the meat is made from.
  flavour_item_id: number | null
  flavour_name: string | null
}

// Categories whose items can be ordered as sausage meat.
export const MEAT_FLAVOUR_CATEGORIES = ['Sausages', 'Gluten Free Sausages']

export function isSausageMeat(item: Pick<MenuItem, 'name' | 'category'>): boolean {
  return (
    item.name.trim().toLowerCase() === 'sausage meat' ||
    item.category.trim().toLowerCase() === 'sausage meat'
  )
}

export function isMeatFlavour(item: Pick<MenuItem, 'category'>): boolean {
  return MEAT_FLAVOUR_CATEGORIES.includes(item.category)
}

// "Porky Sausages (Gluten Free)" -> "Porky (Gluten Free)".
export function flavourLabel(name: string): string {
  return name.replace(/\s+Sausages?\b/i, '').trim()
}

// "Sausage meat – Porky" for flavoured meat, otherwise the item name.
export function orderItemLabel(it: { name: string; flavour_name?: string | null }): string {
  return it.flavour_name ? `${it.name} – ${flavourLabel(it.flavour_name)}` : it.name
}

// Line key used to keep the same item in different flavours apart.
export function lineKey(menuItemId: number, flavourItemId: number | null | undefined): string {
  return `${menuItemId}:${flavourItemId ?? ''}`
}

export type Order = {
  id: number
  menu_id: number | null
  village_id: number | null
  customer_name: string
  email: string
  notes: string
  // Ticked by staff so the driver knows it's someone's first order.
  is_new_customer: boolean
  // 'website' for self-service orders; otherwise how the manager took it.
  source: 'website' | 'email' | 'messenger' | 'phone' | 'in_person'
  created_at: string
  // Joined-in village details for display.
  village_name: string | null
  pickup_time: string | null
  delivery_day: string | null
  items: OrderItem[]
}

// Friday and Saturday are the normal run; Thursday and Sunday are extra days
// for heavy loads or special occasions. Their dates are derived from the
// run's Friday/Saturday, so no extra date needs entering per delivery.
export const DELIVERY_DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function isDeliveryDay(value: string): boolean {
  return (DELIVERY_DAYS as readonly string[]).includes(value)
}

function addDays(date: string | Date, days: number): string {
  const d = new Date(`${toIsoDay(date)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// The calendar date (YYYY-MM-DD) a given delivery day falls on for a run, or
// null when the run has no dates set yet.
export function deliveryDateFor(
  menu: Pick<Menu, 'sale_date' | 'sale_date_end'> | null,
  day: string | null | undefined,
): string | null {
  if (!menu?.sale_date) return null
  const friday = toIsoDay(menu.sale_date)
  const saturday = menu.sale_date_end
    ? toIsoDay(menu.sale_date_end)
    : addDays(friday, 1)
  switch (day) {
    case 'Thursday':
      return addDays(friday, -1)
    case 'Friday':
      return friday
    case 'Saturday':
      return saturday
    case 'Sunday':
      return addDays(saturday, 1)
    default:
      return null
  }
}

// The run's date range, widened to include Thursday/Sunday when any drop-off
// town is actually on one of those days.
export function deliveryRangeFor(
  menu: Pick<Menu, 'sale_date' | 'sale_date_end'> | null,
  daysInUse: Iterable<string | null | undefined>,
  locale: Locale = 'en',
): string {
  if (!menu?.sale_date) return ''
  const used = new Set(daysInUse)
  const start = used.has('Thursday')
    ? deliveryDateFor(menu, 'Thursday')
    : menu.sale_date
  const end = used.has('Sunday')
    ? deliveryDateFor(menu, 'Sunday')
    : menu.sale_date_end
  return formatDeliveryRange(start, end, locale)
}

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export function orderItemLineTotal(item: OrderItem): number {
  return item.price_cents * item.quantity
}

export function orderTotal(order: { items: OrderItem[] }): number {
  return order.items.reduce((sum, it) => sum + orderItemLineTotal(it), 0)
}

// Whether ordering is currently open: the owner's switch must be on AND the
// cutoff must not have passed.
export function isOrderingOpen(
  menu: Pick<Menu, 'cutoff_at' | 'orders_open'> | null,
): boolean {
  if (!menu) return false
  if (menu.orders_open === false) return false
  if (!menu.cutoff_at) return true
  return new Date(menu.cutoff_at).getTime() > Date.now()
}

function toIsoDay(date: string | Date): string {
  return date instanceof Date
    ? date.toISOString().slice(0, 10)
    : date.slice(0, 10)
}

// Formats a sale_date as e.g. "Friday 11 September". Accepts "YYYY-MM-DD" or
// an ISO string from JSON, and a Date when read straight from the database.
export function formatSaleDate(
  date: string | Date | null,
  locale: Locale = 'en',
): string {
  if (!date) return ''
  // A DB `date` column has no timezone, so read its UTC calendar day; strings
  // are truncated to the date part and parsed at local midnight. Either way we
  // avoid a timezone shift changing the weekday.
  const d = new Date(`${toIsoDay(date)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// Formats a sale_date without the weekday, e.g. "11 September" — used where
// the weekday is already shown as a heading.
export function formatShortDate(
  date: string | Date | null,
  locale: Locale = 'en',
): string {
  if (!date) return ''
  const d = new Date(`${toIsoDay(date)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'long' })
}

// Formats a two-day run as e.g. "Friday 11 & Saturday 12 September". Falls
// back to a single date when there is no end date.
export function formatDeliveryRange(
  start: string | Date | null,
  end: string | Date | null,
  locale: Locale = 'en',
): string {
  if (!start) return ''
  if (!end) return formatSaleDate(start, locale)
  const s = new Date(`${toIsoDay(start)}T00:00:00`)
  const e = new Date(`${toIsoDay(end)}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ''
  const sameMonth = s.getMonth() === e.getMonth()
  const startStr = s.toLocaleDateString(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    ...(sameMonth ? {} : { month: 'long' }),
  })
  const endStr = e.toLocaleDateString(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const spansGap = e.getTime() - s.getTime() > 24 * 60 * 60 * 1000
  const j = rangeJoiners(locale)
  return `${startStr} ${spansGap ? j.to : j.and} ${endStr}`
}

/* ------------------------- Grouping by meat mix ------------------------- */

// Words that describe the product type rather than the meat mix. Longest
// first so "Sausage Rolls" is removed before "Sausage".
const PRODUCT_WORDS = [
  /\(gluten free\)/gi,
  /\bgluten free\b/gi,
  /\btraditional ring\b/gi,
  /\bsausage rolls?\b/gi,
  /\bsausage ?meat\b/gi,
  /\bsausages?\b/gi,
  /\bchipolatas?\b/gi,
  /\bpatt(?:y|ies)\b/gi,
]

// Different spellings of the same meat mix, after tidying (lower case).
const MEAT_ALIASES: Record<string, string> = {
  'linc & lush': 'link & lush',
  lincolnshire: 'link & lush',
  cumberland: 'cumberland cracker',
}

function stripProductWords(name: string): string {
  let s = name
  for (const re of PRODUCT_WORDS) s = s.replace(re, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // Christmas items say "Pork Sage & Red Onion" where others say "Sage & Red Onion".
  s = s.replace(/^pork\s+(?=\S)/i, '')
  return s
}

function meatKey(stripped: string): string {
  const k = stripped
    .toLowerCase()
    .replace(/\s+(?:n|and)\s+/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim()
  return MEAT_ALIASES[k] ?? k
}

// Which meat mix an order line is made from, e.g. "Porky Sausage Rolls",
// "Chipolatas Porky" and "Sausage meat – Porky" all give "Porky".
// Returns { key, label }; key is '' when no meat mix can be worked out.
export function meatGroup(it: { name: string; flavour_name?: string | null }): {
  key: string
  label: string
} {
  const source = it.flavour_name || it.name
  const stripped = stripProductWords(source)
  const key = meatKey(stripped)
  return { key, label: stripped }
}

// Order within a meat mix: rolls, sausages, gluten free, chipolatas,
// patties/rings, sausage meat, then anything else.
export function productTypeRank(it: { name: string; flavour_name?: string | null }): number {
  const n = it.name.toLowerCase()
  if (it.flavour_name || /sausage ?meat/.test(n)) return 5
  if (/sausage rolls?/.test(n)) return 0
  if (/chipolata/.test(n)) return 3
  if (/gluten free/.test(n)) return 2
  if (/patt(y|ies)|\bring\b/.test(n)) return 4
  if (/sausage/.test(n)) return 1
  return 6
}

// Group rows under their meat mix. Groups are sorted A–Z with unmatched rows
// ("Other") last; rows inside a group go rolls → sausages → … → sausage meat.
export function groupByMeat<T>(
  rows: T[],
  lineOf: (row: T) => { name: string; flavour_name?: string | null },
): { key: string; label: string; rows: T[] }[] {
  const groups = new Map<string, { key: string; label: string; rows: T[] }>()
  for (const row of rows) {
    const line = lineOf(row)
    const { key, label } = meatGroup(line)
    const g = groups.get(key) ?? { key, label: key ? label : 'Other', rows: [] }
    // Prefer the label that matches the key exactly (the main spelling).
    if (key && label.toLowerCase() === key) g.label = label
    g.rows.push(row)
    groups.set(key, g)
  }
  for (const g of groups.values()) {
    if (g.key && g.label.toLowerCase() !== g.key) {
      // e.g. alias "Cumberland" → show the main name "Cumberland Cracker".
      g.label = g.key.replace(/\b\w/g, (c) => c.toUpperCase())
    }
    g.rows.sort((a, b) => {
      const la = lineOf(a)
      const lb = lineOf(b)
      return productTypeRank(la) - productTypeRank(lb) || la.name.localeCompare(lb.name)
    })
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.key) return 1
    if (!b.key) return -1
    return a.label.localeCompare(b.label)
  })
}
