import { sql } from '@/lib/db'

export type Customer = {
  id: number
  name: string
  email: string
  consented_at: string | null
  subscribed: boolean
  source: string
  last_order_at: string | null
  created_at: string
  // How many past orders belong to this customer (see ORDER_MATCH below).
  order_count: number
}

// One past order in a customer's history.
export type CustomerOrder = {
  id: number
  customer_name: string
  email: string
  notes: string
  source: string
  created_at: string
  // 'email' when the order's email is the customer's; 'name' when the order
  // had no email and only the name matched, so it may be someone else.
  matched_by: 'email' | 'name'
  menu_name: string | null
  sale_date: string | null
  sale_date_end: string | null
  village_name: string | null
  delivery_day: string | null
  items: {
    id: number
    quantity: number
    name: string
    price_cents: number
    flavour_name: string | null
  }[]
}

export type ReminderSend = {
  id: number
  menu_id: number | null
  subject: string
  recipient_count: number
  sent_count: number
  sent_at: string
}

const CUSTOMER_COLUMNS =
  'id, name, email, consented_at, subscribed, source, last_order_at, created_at'

// Tidies a name for comparison: trimmed, lower case, single spaces.
const tidyName = (col: string) =>
  `lower(regexp_replace(trim(${col}), '\\s+', ' ', 'g'))`

// Which orders belong to customer `c` (order alias `o`):
// - certain: the order's email is the customer's email;
// - by name: the order has no email and the name matches exactly (ignoring
//   case and extra spaces). An order with a different email never matches by
//   name, and customers with no name only match by email.
const ORDER_BY_EMAIL = `(trim(c.email) <> '' AND lower(trim(o.email)) = lower(trim(c.email)))`
const ORDER_BY_NAME = `(coalesce(trim(o.email), '') = ''
  AND trim(c.name) <> ''
  AND ${tidyName('o.customer_name')} = ${tidyName('c.name')})`
const ORDER_MATCH = `(${ORDER_BY_EMAIL} OR ${ORDER_BY_NAME})`
const LIST_COLUMNS = `${CUSTOMER_COLUMNS
  .split(', ')
  .map((col) => `c.${col}`)
  .join(', ')},
  (SELECT count(*)::int FROM orders o WHERE ${ORDER_MATCH}) AS order_count`

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Records (or refreshes) a customer when they place an order and tick the
// consent box. Re-subscribes anyone who previously opted out, since ticking
// the box is a fresh consent.
export async function upsertCustomerFromOrder(input: {
  name: string
  email: string
}) {
  const email = normaliseEmail(input.email)
  if (!isValidEmail(email)) return
  await sql`
    INSERT INTO customers (name, email, consented_at, subscribed, source, last_order_at)
    VALUES (${input.name.trim()}, ${email}, now(), true, 'order', now())
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          consented_at = now(),
          subscribed = true,
          last_order_at = now()
  `
}

// Records that an order was placed without marketing consent. We still want to
// know the customer exists (for order history) but must not email them.
export async function touchCustomerWithoutConsent(input: {
  name: string
  email: string
}) {
  const email = normaliseEmail(input.email)
  if (!isValidEmail(email)) return
  await sql`
    INSERT INTO customers (name, email, consented_at, subscribed, source, last_order_at)
    VALUES (${input.name.trim()}, ${email}, NULL, false, 'order', now())
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          last_order_at = now()
  `
}

export async function listCustomers(search: string): Promise<Customer[]> {
  const q = `%${search.trim()}%`
  const rows = search.trim()
    ? await sql`
        SELECT ${sql.unsafe(LIST_COLUMNS)} FROM customers c
        WHERE c.name ILIKE ${q} OR c.email ILIKE ${q}
        ORDER BY lower(c.name) ASC
      `
    : await sql`
        SELECT ${sql.unsafe(LIST_COLUMNS)} FROM customers c
        ORDER BY lower(c.name) ASC
      `
  return rows as Customer[]
}

// A customer's past orders, newest first, with delivery, town and lines.
// Returns null when the customer doesn't exist. Read-only.
export async function listCustomerOrders(
  id: number,
): Promise<CustomerOrder[] | null> {
  const [customer] = await sql`SELECT id FROM customers WHERE id = ${id}`
  if (!customer) return null
  const orders = await sql`
    SELECT o.id, o.customer_name, coalesce(o.email, '') AS email,
           coalesce(o.notes, '') AS notes, o.source, o.created_at,
           CASE WHEN ${sql.unsafe(ORDER_BY_EMAIL)} THEN 'email' ELSE 'name' END AS matched_by,
           m.name AS menu_name, m.sale_date, m.sale_date_end,
           v.name AS village_name, v.delivery_day
    FROM customers c
    JOIN orders o ON ${sql.unsafe(ORDER_MATCH)}
    LEFT JOIN menus m ON m.id = o.menu_id
    LEFT JOIN villages v ON v.id = o.village_id
    WHERE c.id = ${id}
    ORDER BY o.created_at DESC, o.id DESC
  `
  if (orders.length === 0) return []
  const ids = orders.map((o) => o.id as number)
  const items = await sql`
    SELECT oi.id, oi.order_id, oi.quantity, mi.name, mi.price_cents,
           f.name AS flavour_name
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    LEFT JOIN menu_items f ON f.id = oi.flavour_item_id
    WHERE oi.order_id = ANY(${ids})
    ORDER BY oi.id ASC
  `
  const byOrder = new Map<number, CustomerOrder['items']>()
  for (const it of items) {
    const list = byOrder.get(it.order_id as number) ?? []
    list.push({
      id: it.id as number,
      quantity: it.quantity as number,
      name: it.name as string,
      price_cents: it.price_cents as number,
      flavour_name: (it.flavour_name as string | null) ?? null,
    })
    byOrder.set(it.order_id as number, list)
  }
  return orders.map((o) => ({
    ...(o as Omit<CustomerOrder, 'items'>),
    items: byOrder.get(o.id as number) ?? [],
  }))
}

export async function addCustomer(input: {
  name: string
  email: string
}): Promise<Customer> {
  const email = normaliseEmail(input.email)
  const [row] = await sql`
    INSERT INTO customers (name, email, consented_at, subscribed, source)
    VALUES (${input.name.trim()}, ${email}, now(), true, 'manual')
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          consented_at = now(),
          subscribed = true
    RETURNING ${sql.unsafe(CUSTOMER_COLUMNS)}
  `
  return row as Customer
}

export async function updateCustomer(
  id: number,
  patch: { name?: string; email?: string; subscribed?: boolean },
): Promise<Customer | null> {
  const [current] = await sql`
    SELECT ${sql.unsafe(CUSTOMER_COLUMNS)} FROM customers WHERE id = ${id}
  `
  if (!current) return null
  const name = patch.name?.trim() || (current.name as string)
  const email = patch.email
    ? normaliseEmail(patch.email)
    : (current.email as string)
  const subscribed =
    typeof patch.subscribed === 'boolean'
      ? patch.subscribed
      : (current.subscribed as boolean)
  const [row] = await sql`
    UPDATE customers
    SET name = ${name}, email = ${email}, subscribed = ${subscribed}
    WHERE id = ${id}
    RETURNING ${sql.unsafe(CUSTOMER_COLUMNS)}
  `
  return row as Customer
}

// Sign-up from the home page box. Gives consent and subscribes, but never
// overwrites a name already on file. Returns the details needed for the
// confirmation email, or null if the address was already on the list (so a
// repeated sign-up doesn't email them again).
export async function signUpFromWebsite(input: {
  name: string
  email: string
}): Promise<{ name: string; email: string; unsubscribe_token: string } | null> {
  const email = normaliseEmail(input.email)
  const name = input.name.trim()
  const [existing] = await sql`
    SELECT subscribed, consented_at FROM customers WHERE email = ${email}
  `
  if (existing?.subscribed && existing?.consented_at) return null
  const [row] = await sql`
    INSERT INTO customers (name, email, consented_at, subscribed, source)
    VALUES (${name}, ${email}, now(), true, 'signup')
    ON CONFLICT (email) DO UPDATE
      SET consented_at = now(),
          subscribed = true,
          name = CASE WHEN coalesce(trim(customers.name), '') = ''
                      THEN EXCLUDED.name ELSE customers.name END
    RETURNING name, email, unsubscribe_token
  `
  return row as { name: string; email: string; unsubscribe_token: string }
}

export async function deleteCustomer(id: number) {
  await sql`DELETE FROM customers WHERE id = ${id}`
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const rows = await sql`
    UPDATE customers SET subscribed = false
    WHERE unsubscribe_token = ${token}
    RETURNING id
  `
  return rows.length > 0
}

// Everyone we're allowed to email: consented and still subscribed.
export async function listSubscribedRecipients(): Promise<
  { name: string; email: string; unsubscribe_token: string }[]
> {
  const rows = await sql`
    SELECT name, email, unsubscribe_token FROM customers
    WHERE subscribed = true AND consented_at IS NOT NULL
    ORDER BY lower(name) ASC
  `
  return rows as { name: string; email: string; unsubscribe_token: string }[]
}

export async function logReminderSend(input: {
  menu_id: number | null
  subject: string
  recipient_count: number
  sent_count: number
}) {
  await sql`
    INSERT INTO reminder_sends (menu_id, subject, recipient_count, sent_count)
    VALUES (${input.menu_id}, ${input.subject}, ${input.recipient_count}, ${input.sent_count})
  `
}

// Who has already had the "orders open" email for a given delivery, so a
// second press only reaches the people who missed out.
export async function emailedForMenu(menuId: number): Promise<Set<string>> {
  const rows = await sql`
    SELECT email FROM reminder_send_recipients WHERE menu_id = ${menuId}
  `
  return new Set(rows.map((r) => (r.email as string).toLowerCase()))
}

export async function recordReminderRecipients(menuId: number, emails: string[]) {
  if (emails.length === 0) return
  await sql`
    INSERT INTO reminder_send_recipients (menu_id, email)
    SELECT ${menuId}, unnest(${emails.map((e) => e.toLowerCase())}::text[])
    ON CONFLICT DO NOTHING
  `
}

export async function listReminderSends(): Promise<ReminderSend[]> {
  const rows = await sql`
    SELECT id, menu_id, subject, recipient_count, sent_count, sent_at
    FROM reminder_sends ORDER BY sent_at DESC LIMIT 20
  `
  return rows as ReminderSend[]
}
