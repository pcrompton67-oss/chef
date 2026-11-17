import { query } from '@/lib/db'
import { renderEmail, type BankDetails, type EmailKind, type EmailOrder } from '@/lib/email-templates'
import { EMAIL_FROM, EMAIL_REPLY_TO, OWNER_EMAIL } from '@/lib/site'

/**
 * Sending the emails through Resend (issue #13), and the console's email
 * settings. Every email is written to the email_log table: sent, failed, or
 * skipped (no RESEND_API_KEY, or an @example.com test address).
 * Nothing here ever throws: a failed email must never break an order.
 */

/* ---------- Settings (bank details, reminders on/off) ---------- */

export type EmailSettings = BankDetails & { remindersOn: boolean }

const DEFAULT_SETTINGS: EmailSettings = { accountName: '', iban: '', bic: '', remindersOn: true }

export async function getEmailSettings(): Promise<EmailSettings> {
  const [row] = await query<{ value: Partial<EmailSettings> }>(`SELECT value FROM settings WHERE key = 'emails'`)
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) }
}

export async function saveEmailSettings(raw: unknown): Promise<EmailSettings> {
  const b = (raw ?? {}) as Record<string, unknown>
  const t = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const value: EmailSettings = {
    accountName: t(b.accountName, 100),
    iban: t(b.iban, 50).toUpperCase(),
    bic: t(b.bic, 20).toUpperCase(),
    remindersOn: b.remindersOn !== false,
  }
  await query(
    `INSERT INTO settings (key, value) VALUES ('emails', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  )
  return value
}

export function sendingEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/* ---------- Loading an order for an email ---------- */

async function loadOrder(orderId: string): Promise<(EmailOrder & { eventId: string; status: string }) | null> {
  if (!/^\d+$/.test(orderId)) return null
  const [row] = await query<EmailOrder & { eventId: string; status: string; eventTitle: string; eventDate: string }>(
    `SELECT o.id::text, o.name, o.email, o.mobile, o.language, o.diners,
            COALESCE(o.allergies, '') AS allergies, COALESCE(o.notes, '') AS notes, o.source,
            o.payment_method AS "paymentMethod", o.status,
            o.total_cents AS "totalCents", o.deposit_cents AS "depositCents", o.balance_cents AS "balanceCents",
            o.deposit_paid_at IS NOT NULL AS "depositPaid",
            e.id::text AS "eventId", e.title AS "eventTitle", e.event_date::text AS "eventDate",
            p.place, to_char(p.collect_time, 'HH24:MI') AS time, p.address,
            (SELECT json_agg(json_build_object(
                      'name', c.name,
                      'dishes', (SELECT json_agg(json_build_object(
                                          'name', co.name,
                                          'quantity', CASE WHEN c.kind = 'choice' THEN l.quantity END)
                                        ORDER BY co.position)
                                   FROM course_options co
                                   LEFT JOIN order_lines l ON l.course_option_id = co.id AND l.order_id = o.id
                                  WHERE co.course_id = c.id AND (c.kind = 'fixed' OR l.quantity > 0)))
                    ORDER BY c.position)
               FROM courses c WHERE c.event_id = e.id) AS courses
       FROM orders o
       JOIN events e ON e.id = o.event_id
       JOIN collection_points p ON p.id = o.collection_point_id
      WHERE o.id = $1`,
    [orderId],
  )
  if (!row) return null
  const { eventTitle, eventDate, ...rest } = row
  return {
    ...rest,
    courses: (rest.courses ?? []).map((c) => ({ ...c, dishes: c.dishes ?? [] })),
    event: { title: eventTitle, date: eventDate },
  }
}

/* ---------- Sending ---------- */

async function send(
  kind: EmailKind,
  to: string,
  o: EmailOrder & { eventId: string },
  bank: BankDetails,
): Promise<'sent' | 'failed' | 'skipped'> {
  const { subject, html, text } = renderEmail(kind, o, bank)
  const key = process.env.RESEND_API_KEY
  let status: 'sent' | 'failed' | 'skipped' = 'skipped'
  let providerId: string | null = null
  let error: string | null = null

  if (!key) {
    error = 'RESEND_API_KEY is not set'
  } else if (/@example\.com$/i.test(to)) {
    error = 'Test address (@example.com)'
  } else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // Resend ignores a repeat with the same key for 24 hours: a second safety net.
          'Idempotency-Key': `${kind}-${o.id}`,
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: [to], reply_to: EMAIL_REPLY_TO, subject, html, text }),
      })
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
      if (res.ok) {
        status = 'sent'
        providerId = body.id ?? null
      } else {
        status = 'failed'
        error = `${res.status}: ${body.message ?? 'Resend refused the email'}`.slice(0, 500)
      }
    } catch (err) {
      status = 'failed'
      error = String(err).slice(0, 500)
    }
  }

  await query(
    `INSERT INTO email_log (kind, to_email, subject, order_id, event_id, status, provider_id, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [kind, to, subject, o.id, o.eventId, status, providerId, error],
  ).catch((err) => console.error('email_log insert failed', err))
  if (status === 'failed') console.error(`Email ${kind} for order ${o.id} failed: ${error}`)
  return status
}

/** Runs an email job without ever letting an error escape. */
async function safely(label: string, job: () => Promise<unknown>) {
  try {
    await job()
  } catch (err) {
    console.error(`Emails (${label}) failed`, err)
  }
}

/** A new website order: "request received" to the customer, and Eleanor's copy. */
export function emailNewWebsiteOrder(orderId: string) {
  return safely('new order', async () => {
    const o = await loadOrder(orderId)
    if (!o) return
    const settings = await getEmailSettings()
    if (o.email) await send('received', o.email, o, settings)
    await send('owner', OWNER_EMAIL, o, settings)
  })
}

/** An order Eleanor added herself: the customer gets the email that fits its state. */
export function emailNewManualOrder(orderId: string) {
  return safely('manual order', async () => {
    const o = await loadOrder(orderId)
    if (!o || !o.email) return
    const settings = await getEmailSettings()
    await send(o.status === 'confirmed' ? 'confirmed' : 'received', o.email, o, settings)
  })
}

/** "Deposit received" was pressed: the confirmation, with the address. */
export function emailBookingConfirmed(orderId: string) {
  return safely('confirmed', async () => {
    const o = await loadOrder(orderId)
    if (!o || !o.email || o.status !== 'confirmed') return
    await send('confirmed', o.email, o, await getEmailSettings())
  })
}

/**
 * The day-before reminders: every confirmed, not yet collected order for
 * tomorrow's evenings (Paris time) that hasn't already had one.
 */
export async function sendReminders(): Promise<{ sent: number; failed: number; skipped: number; off?: true }> {
  const settings = await getEmailSettings()
  if (!settings.remindersOn) return { sent: 0, failed: 0, skipped: 0, off: true }
  const rows = await query<{ id: string }>(
    `SELECT o.id::text FROM orders o JOIN events e ON e.id = o.event_id
      WHERE e.event_date = (now() AT TIME ZONE 'Europe/Paris')::date + 1
        AND e.status <> 'draft'
        AND o.status = 'confirmed' AND o.collected_at IS NULL AND o.email <> ''
        AND NOT EXISTS (SELECT 1 FROM email_log l
                         WHERE l.kind = 'reminder' AND l.order_id = o.id AND l.status IN ('sent', 'skipped'))
      ORDER BY o.id`,
  )
  const tally = { sent: 0, failed: 0, skipped: 0 }
  for (const { id } of rows) {
    const o = await loadOrder(id)
    if (o) tally[await send('reminder', o.email, o, settings)]++
  }
  return tally
}

/* ---------- The log, for the console ---------- */

export type EmailLogRow = {
  id: string
  sentAt: string // YYYY-MM-DD HH:MM, Paris
  kind: string
  to: string
  subject: string
  status: 'sent' | 'failed' | 'skipped'
  error: string
}

export async function recentEmails(): Promise<EmailLogRow[]> {
  return query<EmailLogRow>(
    `SELECT id::text, to_char(sent_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI') AS "sentAt",
            kind, to_email AS to, COALESCE(subject, '') AS subject, status, COALESCE(error, '') AS error
       FROM email_log ORDER BY sent_at DESC, id DESC LIMIT 40`,
  )
}
