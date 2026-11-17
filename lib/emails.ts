import { query } from '@/lib/db'
import {
  renderEmail,
  renderSignupConfirm,
  renderWeeklyList,
  type BankDetails,
  type EmailKind,
  type EmailOrder,
  type OrderEmailKind,
  type RenderedEmail,
} from '@/lib/email-templates'
import type { Locale } from '@/lib/i18n'
import { mailingListCsv, weeklyListSummary } from '@/lib/customers'
import { getBusinessSettings } from '@/lib/settings'
import { EMAIL_FROM, EMAIL_REPLY_TO, OWNER_EMAIL, SITE_URL } from '@/lib/site'

/**
 * Sending the emails through Resend (issue #13), and the console's email
 * settings. Every email is written to the email_log table: sent, failed, or
 * skipped (no RESEND_API_KEY, or an @example.com test address).
 * Nothing here ever throws: a failed email must never break an order.
 */

/* ---------- Settings (reminders and weekly list on/off; bank details come from Console → Settings) ---------- */

export type EmailSettings = BankDetails & { remindersOn: boolean; weeklyListOn: boolean }

export async function getEmailSettings(): Promise<EmailSettings> {
  const [[row], business] = await Promise.all([
    query<{ value: { remindersOn?: boolean; weeklyListOn?: boolean } }>(`SELECT value FROM settings WHERE key = 'emails'`),
    getBusinessSettings(),
  ])
  const { accountName, iban, bic, holdDays } = business
  return {
    accountName,
    iban,
    bic,
    holdDays,
    remindersOn: row?.value?.remindersOn !== false,
    weeklyListOn: row?.value?.weeklyListOn !== false,
  }
}

/** Saves the reminders and weekly-list switches (bank details are saved in Console → Settings). */
export async function saveEmailSettings(raw: unknown): Promise<EmailSettings> {
  const b = (raw ?? {}) as Record<string, unknown>
  await query(
    `INSERT INTO settings (key, value)
     VALUES ('emails', jsonb_build_object('remindersOn', $1::boolean, 'weeklyListOn', $2::boolean))
     ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`,
    [b.remindersOn !== false, b.weeklyListOn !== false],
  )
  return getEmailSettings()
}

export function sendingEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/* ---------- Loading an order for an email ---------- */

/**
 * One order with everything its emails need. The evening's title and menu are
 * in the customer's language (French wording where Eleanor entered it, issue
 * #12), unless `english` is set (Eleanor's own copy).
 */
async function loadOrder(
  orderId: string,
  english = false,
): Promise<(EmailOrder & { eventId: string; status: string }) | null> {
  if (!/^\d+$/.test(orderId)) return null
  // $2 = false for Eleanor's English copy; otherwise French orders get the French wording.
  const fr = (en: string, frCol: string) =>
    `CASE WHEN $2::boolean AND o.language = 'fr' AND NULLIF(btrim(${frCol}), '') IS NOT NULL THEN ${frCol} ELSE ${en} END`
  const [row] = await query<EmailOrder & { eventId: string; status: string; eventTitle: string; eventDate: string }>(
    `SELECT o.id::text, o.name, o.email, o.mobile, o.language, o.diners,
            COALESCE(o.allergies, '') AS allergies, COALESCE(o.notes, '') AS notes, o.source,
            o.payment_method AS "paymentMethod", o.status,
            o.total_cents AS "totalCents", o.deposit_cents AS "depositCents", o.balance_cents AS "balanceCents",
            o.deposit_paid_at IS NOT NULL AS "depositPaid",
            e.id::text AS "eventId", ${fr('e.title', 'e.title_fr')} AS "eventTitle", e.event_date::text AS "eventDate",
            p.place, to_char(p.collect_time, 'HH24:MI') AS time, p.address,
            CASE WHEN cu.marketing_consent AND cu.unsubscribed_at IS NULL
                 THEN cu.unsubscribe_token END AS "unsubscribeToken",
            (SELECT json_agg(json_build_object(
                      'name', ${fr('c.name', 'c.name_fr')},
                      'dishes', (SELECT json_agg(json_build_object(
                                          'name', ${fr('co.name', 'co.name_fr')},
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
       LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE o.id = $1`,
    [orderId, !english],
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

type Delivery = {
  kind: EmailKind
  to: string
  email: RenderedEmail
  orderId?: string | null
  eventId?: string | null
  /** Resend ignores a repeat with the same key for 24 hours: a second safety net. */
  idempotencyKey: string
  headers?: Record<string, string>
  attachments?: { filename: string; content: string }[] // content in base64
}

/** Sends one email through Resend (unless sending is off or it's a test address) and logs it. */
async function deliver(d: Delivery): Promise<'sent' | 'failed' | 'skipped'> {
  const { subject, html, text } = d.email
  const key = process.env.RESEND_API_KEY
  let status: 'sent' | 'failed' | 'skipped' = 'skipped'
  let providerId: string | null = null
  let error: string | null = null

  if (!key) {
    error = 'RESEND_API_KEY is not set'
  } else if (/@example\.com$/i.test(d.to)) {
    error = 'Test address (@example.com)'
  } else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': d.idempotencyKey,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [d.to],
          reply_to: EMAIL_REPLY_TO,
          subject,
          html,
          text,
          ...(d.headers ? { headers: d.headers } : {}),
          ...(d.attachments ? { attachments: d.attachments } : {}),
        }),
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
    [d.kind, d.to, subject, d.orderId ?? null, d.eventId ?? null, status, providerId, error],
  ).catch((err) => console.error('email_log insert failed', err))
  if (status === 'failed') console.error(`Email ${d.kind} to ${d.to} failed: ${error}`)
  return status
}

/** An email about one order. */
function send(
  kind: OrderEmailKind,
  to: string,
  o: EmailOrder & { eventId: string },
  bank: BankDetails,
): Promise<'sent' | 'failed' | 'skipped'> {
  return deliver({
    kind,
    to,
    email: renderEmail(kind, o, bank),
    orderId: o.id,
    eventId: o.eventId,
    idempotencyKey: `${kind}-${o.id}`,
    // Lets email apps show their own "Unsubscribe" button (customer emails, mailing list only).
    headers:
      kind !== 'owner' && o.unsubscribeToken
        ? {
            'List-Unsubscribe': `<${SITE_URL}/api/unsubscribe?t=${o.unsubscribeToken}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
  })
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
    const own = o.language === 'fr' ? await loadOrder(orderId, true) : o
    if (own) await send('owner', OWNER_EMAIL, own, settings)
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

/* ---------- Mailing list (issue #10) ---------- */

/** The "please confirm" email after someone uses a sign-up box. */
export function emailSignupConfirmation(to: string, locale: Locale, token: string) {
  return safely('signup confirmation', () =>
    deliver({
      kind: 'signup',
      to,
      email: renderSignupConfirm(locale, token),
      idempotencyKey: `signup-${token}-${new Date().toISOString().slice(0, 13)}`,
    }),
  )
}

/**
 * Eleanor's Monday email: who joined and left the list this week, with the
 * full list attached. Sent once a week at most, even if the run repeats.
 */
export async function sendWeeklyList(): Promise<{ status: 'sent' | 'failed' | 'skipped' | 'off' | 'already sent' }> {
  const settings = await getEmailSettings()
  if (!settings.weeklyListOn) return { status: 'off' }
  const [recent] = await query(
    `SELECT 1 FROM email_log WHERE kind = 'weekly' AND status IN ('sent', 'skipped') AND sent_at > now() - interval '5 days'`,
  )
  if (recent) return { status: 'already sent' }
  const [summary, csv] = await Promise.all([weeklyListSummary(), mailingListCsv()])
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const status = await deliver({
    kind: 'weekly',
    to: OWNER_EMAIL,
    email: renderWeeklyList(summary),
    idempotencyKey: `weekly-${today}`,
    attachments: [{ filename: `mailing-list-${today}.csv`, content: Buffer.from(csv, 'utf8').toString('base64') }],
  })
  return { status }
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
