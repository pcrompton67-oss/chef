import { query } from '@/lib/db'
import type { Locale } from '@/lib/i18n'

/*
 * Customers and the mailing list (issue #10).
 *
 * Someone is on the mailing list ("new box dates and other news from Eleanor
 * Jessica") only after ticking the box on an order, or using a sign-up box
 * and then clicking the link in the confirmation email (double opt-in).
 * Nothing else ever gives consent.
 * Unsubscribing (their link, or Eleanor in the console) takes them off.
 * Kept general so restaurant bookings can share these customers later.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** True when someone is on the mailing list. Used everywhere the list is read. */
const ON_LIST = `c.marketing_consent AND c.unsubscribed_at IS NULL`

/* ---------- Public: sign-ups and unsubscribing ---------- */

/**
 * A sign-up box (home page, or "tell me about the next one" on a sold-out
 * evening). Nobody joins the list yet: this records the sign-up and returns
 * the private code for the confirmation email. `send` is false when a
 * confirmation already went to this address for this box in the last hour,
 * so nobody can flood someone's inbox.
 */
export async function requestSignup(
  email: string,
  locale: Locale,
  eventSlug: string,
): Promise<{ ok: false } | { ok: true; send: boolean; email: string; token: string }> {
  const clean = email.trim().slice(0, 200)
  if (!EMAIL.test(clean)) return { ok: false }
  const [row] = await query<{ email: string; token: string; send: boolean }>(
    `WITH ev AS (SELECT id FROM events WHERE slug = $3::text AND status <> 'draft')
     INSERT INTO notify_signups (email, language, event_id, confirm_sent_at)
     VALUES ($1::text, $2::text, (SELECT id FROM ev), now())
     ON CONFLICT (lower(email), coalesce(event_id, 0)) DO UPDATE
        SET language = EXCLUDED.language,
            confirm_sent_at = CASE WHEN notify_signups.confirm_sent_at > now() - interval '1 hour'
                                   THEN notify_signups.confirm_sent_at ELSE now() END
     RETURNING email, confirm_token AS token, confirm_sent_at = now() AS send`,
    [clean, locale, eventSlug.slice(0, 200)],
  )
  return { ok: true, ...row }
}

/**
 * The link in the confirmation email: puts them on the mailing list (this is
 * their consent). Links work for 30 days after the email was sent.
 */
export async function confirmSignup(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(token)) return false
  const [row] = await query<{ n: number }>(
    `WITH s AS (
       UPDATE notify_signups SET confirmed_at = COALESCE(confirmed_at, now())
        WHERE confirm_token = $1 AND confirm_sent_at > now() - interval '30 days'
        RETURNING email, language, event_id
     ),
     cust AS (
       INSERT INTO customers (email, language, marketing_consent, consent_at, source, is_test)
       SELECT s.email, s.language, true, now(), 'signup',
              s.email ILIKE '%@example.com'
              OR COALESCE((SELECT e.is_test FROM events e WHERE e.id = s.event_id), false)
         FROM s
       ON CONFLICT (lower(email)) DO UPDATE
          SET marketing_consent = true,
              consent_at = CASE WHEN customers.marketing_consent THEN customers.consent_at ELSE now() END,
              unsubscribed_at = NULL
       RETURNING id
     )
     SELECT (SELECT count(*) FROM cust)::int AS n`,
    [token],
  )
  return (row?.n ?? 0) > 0
}

/** The unsubscribe link: takes whoever owns this code off the mailing list. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(token)) return false
  const rows = await query(
    `UPDATE customers
        SET marketing_consent = false,
            unsubscribed_at = COALESCE(unsubscribed_at, now())
      WHERE unsubscribe_token = $1
      RETURNING id`,
    [token],
  )
  return rows.length > 0
}

/* ---------- Console → Customers ---------- */

export type CustomerOrder = {
  id: string
  event: string
  date: string // YYYY-MM-DD
  diners: number
  status: string
  totalCents: number
}

export type CustomerSignup = {
  /** The sold-out evening whose page they signed up on (empty = the home page box). */
  event: string
  date: string // YYYY-MM-DD HH:MM, Paris
}

export type CustomerRow = {
  id: string
  name: string
  email: string
  mobile: string
  language: Locale
  /** How we first heard from them: 'website', 'console' or 'signup' ('' if not known). */
  source: string
  onList: boolean
  consentAt: string // YYYY-MM-DD HH:MM, Paris, or ''
  unsubscribedAt: string // YYYY-MM-DD HH:MM, Paris, or ''
  isTest: boolean
  createdAt: string // YYYY-MM-DD
  orders: CustomerOrder[]
  signups: CustomerSignup[]
}

const PARIS = (col: string) => `COALESCE(to_char(${col} AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI'), '')`

export async function listCustomers(): Promise<CustomerRow[]> {
  return query<CustomerRow>(
    `SELECT c.id::text, COALESCE(c.name, '') AS name, c.email, COALESCE(c.mobile, '') AS mobile,
            c.language, COALESCE(c.source, '') AS source, (${ON_LIST}) AS "onList",
            CASE WHEN ${ON_LIST} THEN ${PARIS('c.consent_at')} ELSE '' END AS "consentAt",
            ${PARIS('c.unsubscribed_at')} AS "unsubscribedAt",
            c.is_test AS "isTest",
            to_char(c.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS "createdAt",
            COALESCE((SELECT json_agg(json_build_object(
                               'id', o.id::text, 'event', e.title, 'date', e.event_date::text,
                               'diners', o.diners, 'status', o.status, 'totalCents', o.total_cents)
                             ORDER BY e.event_date DESC, o.id DESC)
                        FROM orders o JOIN events e ON e.id = o.event_id
                       WHERE o.customer_id = c.id), '[]') AS orders,
            COALESCE((SELECT json_agg(json_build_object(
                               'event', COALESCE(e.title, ''),
                               'date', to_char(s.confirmed_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI'))
                             ORDER BY s.confirmed_at DESC)
                        FROM notify_signups s LEFT JOIN events e ON e.id = s.event_id
                       WHERE lower(s.email) = lower(c.email) AND s.confirmed_at IS NOT NULL), '[]') AS signups
       FROM customers c
      ORDER BY c.created_at DESC, c.id DESC`,
  )
}

/** Eleanor takes someone off the list (e.g. they asked her directly). */
export async function unsubscribeCustomer(id: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(id)) return false
  const rows = await query(
    `UPDATE customers
        SET marketing_consent = false,
            unsubscribed_at = COALESCE(unsubscribed_at, now())
      WHERE id = $1
      RETURNING id`,
    [id],
  )
  return rows.length > 0
}

/** The mailing list as a spreadsheet: only real people who are on it. */
export async function mailingListCsv(): Promise<string> {
  const rows = await query<Record<string, string>>(
    `SELECT c.email, COALESCE(c.name, '') AS name, c.language,
            ${PARIS('c.consent_at')} AS consent,
            CASE c.source WHEN 'website' THEN 'Website order' WHEN 'console' THEN 'Order taken by Eleanor'
                          WHEN 'signup' THEN 'Sign-up box' ELSE '' END AS source
       FROM customers c
      WHERE ${ON_LIST} AND NOT c.is_test
      ORDER BY c.consent_at, c.id`,
  )
  const header = ['Email', 'Name', 'Language', 'On the list since', 'Came from']
  const lines = [header, ...rows.map((r) => [r.email, r.name, r.language, r.consent, r.source])]
  // The BOM lets Excel read accents correctly.
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function csvCell(v: string): string {
  // A leading = + - @ could be run as a formula by a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/* ---------- The weekly list for Eleanor ---------- */

export type WeeklyList = {
  total: number
  joined: { name: string; email: string; source: string; date: string }[]
  left: { name: string; email: string; date: string }[]
}

/** Who joined and left the list in the last 7 days, and how many are on it (real people only). */
export async function weeklyListSummary(): Promise<WeeklyList> {
  const [joined, left, [count]] = await Promise.all([
    query<WeeklyList['joined'][number]>(
      `SELECT COALESCE(c.name, '') AS name, c.email, COALESCE(c.source, '') AS source,
              to_char(c.consent_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS date
         FROM customers c
        WHERE ${ON_LIST} AND NOT c.is_test AND c.consent_at > now() - interval '7 days'
        ORDER BY c.consent_at`,
    ),
    query<WeeklyList['left'][number]>(
      `SELECT COALESCE(c.name, '') AS name, c.email,
              to_char(c.unsubscribed_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS date
         FROM customers c
        WHERE NOT c.is_test AND NOT c.marketing_consent AND c.unsubscribed_at > now() - interval '7 days'
        ORDER BY c.unsubscribed_at`,
    ),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM customers c WHERE ${ON_LIST} AND NOT c.is_test`),
  ])
  return { total: count?.n ?? 0, joined, left }
}
