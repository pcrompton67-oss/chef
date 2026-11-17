import { query, transaction } from '@/lib/db'
import { getManagerEvent } from '@/lib/manager-events'
import { getBusinessSettings } from '@/lib/settings'
import type { ConsoleOrder, ManualOrderInput, OrderAction } from '@/lib/order-editing'

/**
 * Orders as Eleanor manages them in the console (/manager → Orders).
 * Includes contact details and addresses, so only ever used behind the PIN.
 */

// Same rule as the public pages and the website order: these orders hold places.
const TAKES_PLACES = `(o.status = 'confirmed'
  OR (o.status IN ('held', 'awaiting_transfer')
      AND (o.hold_expires_at IS NULL OR o.hold_expires_at > now())))`

export async function listOrders(eventId: string): Promise<ConsoleOrder[] | null> {
  if (!/^\d+$/.test(eventId)) return null
  const { holdDays } = await getBusinessSettings()
  // Card orders whose payment page ran out unpaid show as expired (their places are already free).
  await query(
    `UPDATE orders SET status = 'expired', updated_at = now()
      WHERE event_id = $1 AND payment_method = 'card' AND source = 'website' AND status = 'held'
        AND deposit_paid_at IS NULL AND hold_expires_at < now()`,
    [eventId],
  )
  return query<ConsoleOrder>(
    `SELECT o.id::text, to_char(o.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI') AS "createdAt",
            o.name, o.mobile, o.email, o.diners,
            o.collection_point_id::text AS "collectionPointId", p.place, to_char(p.collect_time, 'HH24:MI') AS time,
            COALESCE(o.allergies, '') AS allergies, COALESCE(o.notes, '') AS notes, o.language, o.source,
            o.payment_method AS "paymentMethod", o.status,
            ${TAKES_PLACES} AS "takesPlaces",
            -- Overdue (issue #6): a transfer deposit not paid within the days set in Settings.
            -- Its places stay held until Eleanor confirms the deposit or releases them.
            (o.payment_method = 'bank_transfer' AND o.status IN ('held', 'awaiting_transfer')
              AND o.deposit_paid_at IS NULL AND o.deposit_cents > 0 AND o.collected_at IS NULL
              AND o.created_at < now() - make_interval(days => $2)) AS overdue,
            (o.payment_method = 'card' AND o.source = 'website' AND o.status = 'held'
              AND o.deposit_paid_at IS NULL AND o.hold_expires_at > now()) AS "payingByCard",
            (o.payment_method = 'card' AND o.source = 'website' AND o.status = 'cancelled'
              AND o.refund_status IN ('requested', 'partial') AND starts_with(o.payment_reference, 'pi_')) AS "cardRefundable",
            o.total_cents AS "totalCents", o.deposit_cents AS "depositCents",
            o.deposit_paid_at IS NOT NULL AS "depositPaid",
            o.balance_cents AS "balanceCents", o.balance_paid_at IS NOT NULL AS "balancePaid",
            o.balance_method AS "balanceMethod", COALESCE(o.payment_reference, '') AS "paymentReference",
            o.collected_at IS NOT NULL AS collected,
            o.refund_status AS "refundStatus", o.refund_cents AS "refundCents", o.is_test AS "isTest",
            COALESCE((SELECT json_agg(json_build_object('optionId', l.course_option_id::text, 'quantity', l.quantity))
                        FROM order_lines l WHERE l.order_id = o.id), '[]') AS lines
       FROM orders o JOIN collection_points p ON p.id = o.collection_point_id
      WHERE o.event_id = $1
      ORDER BY o.created_at DESC, o.id DESC`,
    [eventId, holdDays],
  )
}

export type ActionResult = { ok: true } | { ok: false; error: string }

/** The buttons on an order: deposit received, collected, cancel, refund sent. */
export async function applyOrderAction(id: string, a: OrderAction): Promise<ActionResult> {
  if (!/^\d+$/.test(id)) return { ok: false, error: 'Order not found.' }
  const ref = 'reference' in a ? (a.reference ?? '').trim().slice(0, 100) : ''
  let sql: string
  let params: unknown[] = [id]

  switch (a.action) {
    case 'deposit_received':
      sql = `UPDATE orders SET status = 'confirmed', deposit_paid_at = now(),
               payment_reference = COALESCE(NULLIF($2, ''), payment_reference), updated_at = now()
             WHERE id = $1 AND status IN ('held', 'awaiting_transfer') RETURNING id`
      params = [id, ref]
      break
    case 'collected':
      if (a.method !== 'cash' && a.method !== 'cheque') return { ok: false, error: 'Choose cash or cheque.' }
      // If the deposit hadn't been paid, the whole amount is paid now.
      sql = `UPDATE orders SET status = 'confirmed', deposit_paid_at = COALESCE(deposit_paid_at, now()),
               collected_at = now(), balance_paid_at = now(), balance_method = $2, updated_at = now()
             WHERE id = $1 AND status IN ('held', 'awaiting_transfer', 'confirmed') AND collected_at IS NULL
             RETURNING id`
      params = [id, a.method]
      break
    case 'undo_collected':
      sql = `UPDATE orders SET collected_at = NULL, balance_paid_at = NULL, balance_method = NULL, updated_at = now()
             WHERE id = $1 AND collected_at IS NOT NULL RETURNING id`
      break
    case 'cancel':
      // Anything already paid becomes a refund to make.
      sql = `UPDATE orders SET status = 'cancelled',
               refund_cents = CASE WHEN deposit_paid_at IS NOT NULL THEN deposit_cents ELSE 0 END
                            + CASE WHEN balance_paid_at IS NOT NULL THEN balance_cents ELSE 0 END,
               refund_status = CASE WHEN (deposit_paid_at IS NOT NULL AND deposit_cents > 0)
                                      OR (balance_paid_at IS NOT NULL AND balance_cents > 0)
                                    THEN 'requested' ELSE 'none' END,
               updated_at = now()
             WHERE id = $1 AND status IN ('held', 'awaiting_transfer', 'confirmed') RETURNING id`
      break
    case 'refund_sent':
      sql = `UPDATE orders SET refund_status = 'refunded', updated_at = now()
             WHERE id = $1 AND refund_status IN ('requested', 'partial') RETURNING id`
      break
    default:
      return { ok: false, error: 'Unknown action.' }
  }

  const rows = await query(sql, params)
  return rows.length
    ? { ok: true }
    : { ok: false, error: 'That can’t be done for this order any more. Please refresh the page.' }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCES = ['phone', 'whatsapp', 'email', 'messenger', 'in_person']
const METHODS = ['cash', 'cheque', 'bank_transfer', 'card']

export type ManualResult =
  | { ok: true; id: string }
  | { ok: false; error: string; placesLeft?: number; overCapacity?: boolean }

/** An order Eleanor takes herself (phone, WhatsApp, in person …). */
export async function addManualOrder(raw: unknown): Promise<ManualResult> {
  const b = (raw ?? {}) as Record<string, unknown>
  const t = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const input: ManualOrderInput = {
    eventId: t(b.eventId, 20),
    collectionPointId: t(b.collectionPointId, 20),
    diners: Number(b.diners),
    choices: (b.choices && typeof b.choices === 'object' ? b.choices : {}) as Record<string, number>,
    name: t(b.name),
    mobile: t(b.mobile, 40),
    email: t(b.email),
    allergies: t(b.allergies, 1000),
    notes: t(b.notes, 1000),
    language: b.language === 'fr' ? 'fr' : 'en',
    source: t(b.source, 20),
    paymentMethod: t(b.paymentMethod, 20),
    depositPaid: b.depositPaid === true,
    reference: t(b.reference, 100),
    marketing: b.marketing === true,
    overbook: b.overbook === true,
  }

  const found = await getManagerEvent(input.eventId)
  if (!found) return { ok: false, error: 'This evening no longer exists.' }
  const { event } = found

  if (!event.collectionPoints.some((p) => p.id === input.collectionPointId))
    return { ok: false, error: 'Please choose the collection point.' }
  if (!Number.isInteger(input.diners) || input.diners < 1 || input.diners > 100)
    return { ok: false, error: 'Please enter the number of diners.' }
  if (!input.name) return { ok: false, error: 'Please enter the customer’s name.' }
  if (!input.mobile && !input.email) return { ok: false, error: 'Please enter a phone number or an email.' }
  if (input.email && !EMAIL.test(input.email)) return { ok: false, error: 'That email address doesn’t look right.' }
  if (!SOURCES.includes(input.source)) return { ok: false, error: 'Please say how the order came in.' }
  if (!METHODS.includes(input.paymentMethod)) return { ok: false, error: 'Please choose how the deposit is paid.' }

  // Same dish check as the website: each choice course adds up to the diners.
  const optionIds: string[] = []
  const quantities: number[] = []
  for (const course of event.courses.filter((c) => c.kind === 'choice')) {
    let total = 0
    for (const o of course.options) {
      const n = Number(input.choices[o.id!] ?? 0)
      if (!Number.isInteger(n) || n < 0) return { ok: false, error: `Please check the dishes for “${course.name}”.` }
      total += n
      if (n > 0) {
        optionIds.push(o.id!)
        quantities.push(n)
      }
    }
    if (total !== input.diners)
      return {
        ok: false,
        error: `“${course.name}”: ${total} dish${total === 1 ? '' : 'es'} chosen for ${input.diners} diner${input.diners === 1 ? '' : 's'}.`,
      }
  }

  const [, [r]] = await transaction([
    // Lock the event so the count of places can't change while we save.
    { text: 'SELECT id FROM events WHERE id = $1 FOR UPDATE', params: [input.eventId] },
    {
      text: MANUAL_ORDER_SQL,
      params: [
        input.eventId, input.diners, input.collectionPointId, input.name, input.mobile,
        input.email, input.allergies || null, input.language, input.marketing, optionIds, quantities,
        input.source, input.paymentMethod, input.depositPaid, input.reference || null,
        input.overbook, input.notes || null,
      ],
    },
  ])
  const res = r as { places_left: number; order_id: string | null }
  if (res.order_id) return { ok: true, id: res.order_id }
  return {
    ok: false,
    overCapacity: true,
    placesLeft: res.places_left,
    error: `Only ${res.places_left} place${res.places_left === 1 ? '' : 's'} left. Tick “Book anyway” to overbook.`,
  }
}

// $1 event · $2 diners · $3 collection point · $4 name · $5 mobile · $6 email · $7 allergies
// $8 language · $9 marketing · $10 option ids · $11 quantities · $12 source · $13 payment method
// $14 deposit paid · $15 reference · $16 overbook · $17 notes
const MANUAL_ORDER_SQL = `
WITH ev AS (
  SELECT e.id, e.is_test, e.price_cents, e.deposit_cents,
         (e.capacity - COALESCE((SELECT sum(o.diners) FROM orders o
                                  WHERE o.event_id = e.id AND ${TAKES_PLACES}), 0))::int AS places_left
    FROM events e WHERE e.id = $1::bigint
),
ok AS (SELECT * FROM ev WHERE places_left >= $2::int OR $16::boolean),
-- Remember the customer only when there's an email (phone orders may have none).
cust AS (
  INSERT INTO customers (name, email, mobile, language, marketing_consent, consent_at, source, is_test)
  SELECT $4::text, $6::text, NULLIF($5::text, ''), $8::text, $9::boolean,
         CASE WHEN $9::boolean THEN now() END, 'console', ok.is_test
    FROM ok WHERE $6::text <> ''
  ON CONFLICT (lower(email)) DO UPDATE
     SET name = EXCLUDED.name,
         mobile = COALESCE(EXCLUDED.mobile, customers.mobile),
         language = EXCLUDED.language,
         marketing_consent = customers.marketing_consent OR EXCLUDED.marketing_consent,
         consent_at = CASE WHEN customers.marketing_consent THEN customers.consent_at
                           ELSE EXCLUDED.consent_at END,
         unsubscribed_at = CASE WHEN EXCLUDED.marketing_consent THEN NULL
                                ELSE customers.unsubscribed_at END
  RETURNING id
),
ord AS (
  INSERT INTO orders (event_id, collection_point_id, customer_id, diners, name, mobile, email,
                      allergies, notes, language, source, payment_method, status,
                      total_cents, deposit_cents, deposit_paid_at, balance_cents, payment_reference, is_test)
  SELECT ok.id, $3::bigint, (SELECT id FROM cust), $2::int, $4::text, $5::text, $6::text,
         $7::text, $17::text, $8::text, $12::text, $13::text,
         CASE WHEN $14::boolean OR ok.deposit_cents = 0 THEN 'confirmed' ELSE 'held' END,
         ok.price_cents * $2::int, ok.deposit_cents * $2::int,
         CASE WHEN $14::boolean OR ok.deposit_cents = 0 THEN now() END,
         (ok.price_cents - ok.deposit_cents) * $2::int, $15::text, ok.is_test
    FROM ok
  RETURNING id
),
lines AS (
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  SELECT ord.id, x.option_id, x.quantity
    FROM ord, unnest($10::bigint[], $11::int[]) AS x(option_id, quantity)
)
SELECT ev.places_left, (SELECT id::text FROM ord) AS order_id FROM ev`
