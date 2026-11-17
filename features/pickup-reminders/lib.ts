import { sql } from '@/lib/db'
import { sendInBulk } from '@/lib/bulk-email'
import type { SendResult } from '@/lib/send-result'
import { deliveryDateFor, formatPrice, formatSaleDate } from '@/lib/types'

// The business runs on French time; every "tomorrow" and "18:00" here means
// Europe/Paris, whatever timezone the server or cron runs in.
const TIMEZONE = 'Europe/Paris'
export const SEND_HOUR = 18
const SETTING_KEY = 'pickup_reminders_enabled'

export type PickupRecipient = {
  name: string
  email: string
  town: string
  pickupTime: string
  lines: { name: string; quantity: number; price_cents: number }[]
}

export type PickupSendLog = {
  delivery_date: string
  trigger: string
  recipient_count: number
  sent_count: number
  sent_at: string
}

/* ------------------------------- Time helpers ---------------------------- */

function parisParts(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  }
}

function addDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function parisTomorrow(now = new Date()): string {
  return addDays(parisParts(now).date, 1)
}

export function isSendHour(now = new Date()): boolean {
  return parisParts(now).hour === SEND_HOUR
}

/* --------------------------------- Setting ------------------------------- */

export async function getRemindersEnabled(): Promise<boolean> {
  const rows = await sql`SELECT value FROM app_settings WHERE key = ${SETTING_KEY}`
  return rows[0]?.value === true
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${SETTING_KEY}, ${JSON.stringify(enabled)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
}

/* ------------------------------- Recipients ------------------------------ */

/**
 * Everyone with an order dropped off on `deliveryDate`, one entry per email
 * and town so a customer with two orders gets a single combined reminder.
 * Orders without an email (most hand-entered Messenger orders) are skipped.
 */
export async function recipientsFor(deliveryDate: string): Promise<PickupRecipient[]> {
  // A run's days span Thursday–Sunday around its Friday, so only runs whose
  // Friday is within a few days of the target date can match.
  const orders = await sql`
    SELECT o.id, o.customer_name, o.email, o.village_id,
           v.name AS town, v.pickup_time, v.delivery_day,
           m.sale_date, m.sale_date_end
    FROM orders o
    JOIN villages v ON v.id = o.village_id
    JOIN menus m ON m.id = o.menu_id
    WHERE m.sale_date BETWEEN (${deliveryDate}::date - 3) AND (${deliveryDate}::date + 1)
      AND coalesce(trim(o.email), '') <> ''
  `
  const matching = orders.filter(
    (o) =>
      deliveryDateFor(
        { sale_date: o.sale_date as string, sale_date_end: o.sale_date_end as string | null },
        o.delivery_day as string,
      ) === deliveryDate,
  )
  if (matching.length === 0) return []

  const ids = matching.map((o) => o.id as number)
  const items = await sql`
    SELECT oi.order_id, oi.quantity, mi.price_cents,
           CASE WHEN f.name IS NULL THEN mi.name
                ELSE mi.name || ' – ' || TRIM(REGEXP_REPLACE(f.name, '\s+Sausages?\M', '', 'i'))
           END AS name
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    LEFT JOIN menu_items f ON f.id = oi.flavour_item_id
    WHERE oi.order_id = ANY(${ids})
    ORDER BY oi.id
  `

  const grouped = new Map<string, PickupRecipient>()
  for (const o of matching) {
    const email = (o.email as string).trim().toLowerCase()
    const key = `${email}|${o.village_id}`
    const entry =
      grouped.get(key) ??
      ({
        name: o.customer_name as string,
        email,
        town: o.town as string,
        pickupTime: (o.pickup_time as string) ?? '',
        lines: [],
      } satisfies PickupRecipient)
    for (const it of items.filter((i) => i.order_id === o.id)) {
      const existing = entry.lines.find((l) => l.name === it.name)
      if (existing) existing.quantity += it.quantity as number
      else
        entry.lines.push({
          name: it.name as string,
          quantity: it.quantity as number,
          price_cents: it.price_cents as number,
        })
    }
    grouped.set(key, entry)
  }
  return [...grouped.values()]
}

/* ---------------------------------- Email -------------------------------- */

export function buildPickupEmail(
  r: Pick<PickupRecipient, 'name' | 'town' | 'pickupTime' | 'lines'>,
  deliveryDate: string,
): { subject: string; text: string } {
  const firstName = r.name.trim().split(/\s+/)[0] || 'there'
  const when = r.pickupTime ? ` at approx. ${r.pickupTime}` : ''
  const total = r.lines.reduce((s, l) => s + l.price_cents * l.quantity, 0)
  return {
    subject: `Reminder: your drop-off is tomorrow${when.replace(' approx.', '')} in ${r.town}`,
    text: [
      `Hi ${firstName},`,
      ``,
      `Don't forget, your Magnificent Sausage Rolls order will be dropped off tomorrow, ${formatSaleDate(deliveryDate)}${when} in ${r.town}.`,
      ``,
      `Your order:`,
      ...r.lines.map(
        (l) => `  ${l.quantity} x ${l.name} — ${formatPrice(l.price_cents * l.quantity)}`,
      ),
      ``,
      `Total: ${formatPrice(total)}`,
      ``,
      `Drop-off times are approximate as we deliver to around 10 towns a day. Everything is delivered frozen and ready to cook, so please get it into the freezer (or the oven!) on the day.`,
      ``,
      `See you tomorrow!`,
      `— Magnificent Sausage Rolls & Sausages`,
      `Handcrafted in Valence-en-Poitou 86700`,
    ].join('\n'),
  }
}

/* ---------------------------------- Send --------------------------------- */

export type RunResult =
  | ({ status: 'sent'; deliveryDate: string } & SendResult)
  | { status: 'already_sent' | 'no_orders' | 'not_configured'; deliveryDate: string }

/**
 * Sends tomorrow's reminders once. The date is claimed in pickup_reminder_sends
 * BEFORE sending, so two overlapping cron runs (or a cron plus a manual send)
 * can never email customers twice.
 */
export async function sendPickupReminders(
  deliveryDate: string,
  trigger: 'cron' | 'manual',
): Promise<RunResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { status: 'not_configured', deliveryDate }

  const recipients = await recipientsFor(deliveryDate)
  if (recipients.length === 0) return { status: 'no_orders', deliveryDate }

  const claimed = await sql`
    INSERT INTO pickup_reminder_sends (delivery_date, trigger, recipient_count)
    VALUES (${deliveryDate}, ${trigger}, ${recipients.length})
    ON CONFLICT (delivery_date) DO NOTHING
    RETURNING id
  `
  // A date that has been run before only goes again as a manual catch-up,
  // and then only to the people who did not get it the first time.
  if (claimed.length === 0 && trigger === 'cron') return { status: 'already_sent', deliveryDate }

  const alreadyEmailed = await sentEmailsFor(deliveryDate)
  const pending = recipients.filter((r) => !alreadyEmailed.has(r.email))
  if (pending.length === 0) return { status: 'already_sent', deliveryDate }

  const result = await sendInBulk(
    pending.map((r) => ({ to: r.email, ...buildPickupEmail(r, deliveryDate) })),
    (emails) => recordSent(deliveryDate, emails),
    'pickup-reminders',
  )

  await sql`
    UPDATE pickup_reminder_sends
    SET sent_count = (SELECT count(*) FROM pickup_reminder_recipients WHERE delivery_date = ${deliveryDate}),
        recipient_count = ${recipients.length}, sent_at = now()
    WHERE delivery_date = ${deliveryDate}
  `
  return { status: 'sent', deliveryDate, ...result }
}

async function recordSent(deliveryDate: string, emails: string[]) {
  if (emails.length === 0) return
  await sql`
    INSERT INTO pickup_reminder_recipients (delivery_date, email)
    SELECT ${deliveryDate}, unnest(${emails}::text[])
    ON CONFLICT DO NOTHING
  `
}

async function sentEmailsFor(deliveryDate: string): Promise<Set<string>> {
  const rows = await sql`
    SELECT email FROM pickup_reminder_recipients WHERE delivery_date = ${deliveryDate}
  `
  return new Set(rows.map((r) => (r.email as string).toLowerCase()))
}

/** How many of tomorrow's recipients have not been emailed yet. */
export async function missedCountFor(
  deliveryDate: string,
  recipients: PickupRecipient[],
): Promise<number> {
  const emailed = await sentEmailsFor(deliveryDate)
  return recipients.filter((r) => !emailed.has(r.email)).length
}

export async function listPickupSends(): Promise<PickupSendLog[]> {
  const rows = await sql`
    SELECT to_char(delivery_date, 'YYYY-MM-DD') AS delivery_date, trigger,
           recipient_count, sent_count, sent_at
    FROM pickup_reminder_sends ORDER BY delivery_date DESC LIMIT 6
  `
  return rows as PickupSendLog[]
}

export async function wasSentFor(deliveryDate: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM pickup_reminder_sends WHERE delivery_date = ${deliveryDate}`
  return rows.length > 0
}
