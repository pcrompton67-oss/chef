import { query } from '@/lib/db'
import type { Locale } from '@/lib/i18n'

/*
 * Customers and the mailing list (issue #10).
 *
 * Someone is on the mailing list ("new box dates and other news from Eleanor
 * Jessica") only after ticking the box on an order, or signing up with a
 * "tell me about the next one" box. Nothing else ever gives consent.
 * Unsubscribing (their link, or Eleanor in the console) takes them off.
 * Kept general so restaurant bookings can share these customers later.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** True when someone is on the mailing list. Used everywhere the list is read. */
const ON_LIST = `c.marketing_consent AND c.unsubscribed_at IS NULL`

/* ---------- Public: sign-ups and unsubscribing ---------- */

/**
 * A "tell me about the next one" sign-up. Puts the email on the mailing list
 * (a sign-up is consent) and records which evening's page it came from.
 */
export async function addSignup(email: string, locale: Locale, eventSlug: string): Promise<boolean> {
  const clean = email.trim().slice(0, 200)
  if (!EMAIL.test(clean)) return false
  await query(
    `WITH ev AS (
       SELECT id, is_test FROM events WHERE slug = $3::text AND status <> 'draft'
     ),
     cust AS (
       INSERT INTO customers (email, language, marketing_consent, consent_at, source, is_test)
       VALUES ($1::text, $2::text, true, now(), 'signup',
               $1::text ILIKE '%@example.com' OR COALESCE((SELECT is_test FROM ev), false))
       ON CONFLICT (lower(email)) DO UPDATE
          SET marketing_consent = true,
              consent_at = CASE WHEN customers.marketing_consent THEN customers.consent_at ELSE now() END,
              unsubscribed_at = NULL
     )
     INSERT INTO notify_signups (email, language, event_id)
     VALUES ($1::text, $2::text, (SELECT id FROM ev))
     ON CONFLICT (lower(email), coalesce(event_id, 0)) DO NOTHING`,
    [clean, locale, eventSlug.slice(0, 200)],
  )
  return true
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
  /** The evening whose page they signed up on (empty if not known). */
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
                               'date', to_char(s.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI'))
                             ORDER BY s.created_at DESC)
                        FROM notify_signups s LEFT JOIN events e ON e.id = s.event_id
                       WHERE lower(s.email) = lower(c.email)), '[]') AS signups
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
