import { query, transaction } from '@/lib/db'
import { getManagerEvent } from '@/lib/manager-events'
import { getBusinessSettings } from '@/lib/settings'
import type { EditableEvent } from '@/lib/event-editing'
import {
  canChangeOrder,
  repriceOrder,
  type ConsoleOrder,
  type ManualOrderInput,
  type OrderAction,
  type OrderChangeInput,
} from '@/lib/order-editing'

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
            -- Card money to give back: a cancelled order, or part of the deposit after fewer diners (issue #21).
            (o.payment_method = 'card' AND o.source = 'website' AND o.deposit_paid_at IS NOT NULL
              AND o.refund_status IN ('requested', 'partial') AND starts_with(o.payment_reference, 'pi_')
              AND o.refund_cents > CASE WHEN o.balance_paid_at IS NOT NULL THEN o.balance_cents ELSE 0 END) AS "cardRefundable",
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
               -- (plus any refund still to send from an earlier change of diners, issue #21)
               refund_cents = CASE WHEN deposit_paid_at IS NOT NULL THEN deposit_cents ELSE 0 END
                            + CASE WHEN balance_paid_at IS NOT NULL THEN balance_cents ELSE 0 END
                            + CASE WHEN refund_status = 'requested' THEN refund_cents ELSE 0 END,
               refund_status = CASE WHEN (deposit_paid_at IS NOT NULL AND deposit_cents > 0)
                                      OR (balance_paid_at IS NOT NULL AND balance_cents > 0)
                                      OR (refund_status = 'requested' AND refund_cents > 0)
                                    THEN 'requested'
                                    WHEN refund_status = 'refunded' THEN 'refunded' ELSE 'none' END,
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

/** Same dish check as the website: each choice course adds up to the diners. */
function checkDishes(
  event: EditableEvent,
  diners: number,
  choices: Record<string, number>,
): { ok: true; optionIds: string[]; quantities: number[] } | { ok: false; error: string } {
  const optionIds: string[] = []
  const quantities: number[] = []
  for (const course of event.courses.filter((c) => c.kind === 'choice')) {
    let total = 0
    for (const o of course.options) {
      const n = Number(choices[o.id!] ?? 0)
      if (!Number.isInteger(n) || n < 0) return { ok: false, error: `Please check the dishes for “${course.name}”.` }
      total += n
      if (n > 0) {
        optionIds.push(o.id!)
        quantities.push(n)
      }
    }
    if (total !== diners)
      return {
        ok: false,
        error: `“${course.name}”: ${total} dish${total === 1 ? '' : 'es'} chosen for ${diners} diner${diners === 1 ? '' : 's'}.`,
      }
  }
  return { ok: true, optionIds, quantities }
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

  const dishes = checkDishes(event, input.diners, input.choices)
  if (!dishes.ok) return dishes
  const { optionIds, quantities } = dishes

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

/* ---------- Changing an order (issue #21) ---------- */

/**
 * Eleanor changes an order when a customer asks: diners, dishes, collection
 * point, allergies, notes, contact details. Same dish check and the same event
 * lock as a new order; more diners than places left only with "Book anyway".
 * Money follows repriceOrder(). No email is sent: Eleanor tells the customer.
 */
export async function changeOrder(id: string, raw: unknown): Promise<ManualResult> {
  if (!/^\d+$/.test(id)) return { ok: false, error: 'Order not found.' }
  const b = (raw ?? {}) as Record<string, unknown>
  const t = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const input: OrderChangeInput = {
    collectionPointId: t(b.collectionPointId, 20),
    diners: Number(b.diners),
    choices: (b.choices && typeof b.choices === 'object' ? b.choices : {}) as Record<string, number>,
    name: t(b.name),
    mobile: t(b.mobile, 40),
    email: t(b.email),
    allergies: t(b.allergies, 1000),
    notes: t(b.notes, 1000),
    language: b.language === 'fr' ? 'fr' : 'en',
    overbook: b.overbook === true,
  }

  const [cur] = await query<{
    eventId: string
    updatedAt: string
    diners: number
    email: string
    status: ConsoleOrder['status']
    collected: boolean
    paymentMethod: string
    source: string
    depositPaid: boolean
    totalCents: number
    depositCents: number
    refundStatus: ConsoleOrder['refundStatus']
    refundCents: number
  }>(
    `SELECT event_id::text AS "eventId", updated_at::text AS "updatedAt", diners, email, status,
            collected_at IS NOT NULL AS collected, payment_method AS "paymentMethod", source,
            deposit_paid_at IS NOT NULL AS "depositPaid", total_cents AS "totalCents",
            deposit_cents AS "depositCents", refund_status AS "refundStatus", refund_cents AS "refundCents"
       FROM orders WHERE id = $1`,
    [id],
  )
  if (!cur) return { ok: false, error: 'Order not found.' }
  if (!canChangeOrder(cur)) return { ok: false, error: 'This order can’t be changed any more. Please refresh the page.' }

  const found = await getManagerEvent(cur.eventId)
  if (!found) return { ok: false, error: 'This evening no longer exists.' }
  const { event } = found

  if (!event.collectionPoints.some((p) => p.id === input.collectionPointId))
    return { ok: false, error: 'Please choose the collection point.' }
  if (!Number.isInteger(input.diners) || input.diners < 1 || input.diners > 100)
    return { ok: false, error: 'Please enter the number of diners.' }
  if (!input.name) return { ok: false, error: 'Please enter the customer’s name.' }
  if (!input.mobile && !input.email) return { ok: false, error: 'Please enter a phone number or an email.' }
  if (input.email && !EMAIL.test(input.email)) return { ok: false, error: 'That email address doesn’t look right.' }

  const dishes = checkDishes(event, input.diners, input.choices)
  if (!dishes.ok) return dishes

  const money = repriceOrder(cur, input.diners)
  // Keep a note when the change means money goes back to the customer.
  const before = repriceOrder(cur, cur.diners).refundCents
  let notes = input.notes
  if (money.refundCents > before) {
    const line = `Changed from ${cur.diners} to ${input.diners} diner${input.diners === 1 ? '' : 's'}: €${((money.refundCents - before) / 100).toFixed(2)} of the deposit to refund.`
    notes = (notes ? `${notes}\n` : '') + line
  }
  const refundStatus =
    money.refundCents > 0 ? 'requested' : cur.refundStatus === 'requested' ? 'none' : cur.refundStatus
  const refundCents = money.refundCents > 0 || cur.refundStatus === 'requested' ? money.refundCents : cur.refundCents
  const emailChanged = input.email.toLowerCase() !== (cur.email ?? '').toLowerCase()

  // Every step after the first only acts if the order really was just updated
  // (updated_at = now(), which stays the same for the whole transaction).
  const justChanged = `(SELECT updated_at = now() FROM orders WHERE id = $1)`
  const results = await transaction([
    // Lock the event so the count of places can't change while we save.
    { text: 'SELECT id FROM events WHERE id = $1 FOR UPDATE', params: [cur.eventId] },
    {
      text: CHANGE_ORDER_SQL,
      params: [
        id, cur.updatedAt, cur.diners, input.diners, input.overbook, input.collectionPointId,
        input.name, input.mobile, input.email, input.allergies || null, notes || null, input.language,
        money.totalCents, money.depositCents, money.balanceCents, refundStatus, refundCents,
      ],
    },
    { text: `DELETE FROM order_lines WHERE order_id = $1 AND ${justChanged}`, params: [id] },
    {
      text: `INSERT INTO order_lines (order_id, course_option_id, quantity)
             SELECT $1::bigint, x.option_id, x.quantity
               FROM unnest($2::bigint[], $3::int[]) AS x(option_id, quantity)
              WHERE ${justChanged}`,
      params: [id, dishes.optionIds, dishes.quantities],
    },
    // A new email address: link the order to that customer (remembered without
    // joining the mailing list); no email: no customer record.
    ...(emailChanged
      ? [
          {
            text: `INSERT INTO customers (name, email, mobile, language, marketing_consent, source, is_test)
                   SELECT o.name, o.email, NULLIF(o.mobile, ''), o.language, false, 'console', o.is_test
                     FROM orders o WHERE o.id = $1 AND o.email <> '' AND o.updated_at = now()
                   ON CONFLICT (lower(email)) DO NOTHING`,
            params: [id],
          },
          {
            text: `UPDATE orders o SET customer_id = (SELECT c.id FROM customers c WHERE lower(c.email) = lower(o.email) AND o.email <> '')
                    WHERE o.id = $1 AND o.updated_at = now()`,
            params: [id],
          },
        ]
      : []),
  ])
  const res = results[1][0] as { places_left: number; changed: boolean; same: boolean }
  if (res.changed) return { ok: true, id }
  if (!res.same) return { ok: false, error: 'This order was changed meanwhile. Please refresh the page and try again.' }
  return {
    ok: false,
    overCapacity: true,
    placesLeft: res.places_left,
    error: `Only ${res.places_left} place${res.places_left === 1 ? '' : 's'} left for this order. Tick “Book anyway” to overbook.`,
  }
}

// $1 order · $2 its updated_at when read · $3 diners before · $4 diners now · $5 overbook
// $6 collection point · $7 name · $8 mobile · $9 email · $10 allergies · $11 notes · $12 language
// $13 total · $14 deposit · $15 balance · $16 refund status · $17 refund
const CHANGE_ORDER_SQL = `
WITH cur AS (
  SELECT o.id, o.event_id, (o.updated_at = $2::timestamptz) AS same FROM orders o WHERE o.id = $1::bigint
),
ev AS (
  -- Places left for this order: the evening's capacity less every other order holding places.
  SELECT (e.capacity - COALESCE((SELECT sum(o.diners) FROM orders o
                                  WHERE o.event_id = e.id AND o.id <> $1::bigint AND ${TAKES_PLACES}), 0))::int AS places_left
    FROM events e JOIN cur ON cur.event_id = e.id
),
upd AS (
  UPDATE orders o
     SET collection_point_id = $6::bigint, diners = $4::int, name = $7::text, mobile = $8::text,
         email = $9::text, allergies = $10::text, notes = $11::text, language = $12::text,
         total_cents = $13::int, deposit_cents = $14::int, balance_cents = $15::int,
         refund_status = $16::text, refund_cents = $17::int, updated_at = now()
    FROM ev, cur
   WHERE o.id = cur.id AND cur.same
     AND o.status IN ('held', 'awaiting_transfer', 'confirmed') AND o.collected_at IS NULL
     AND ($4::int <= $3::int OR ev.places_left >= $4::int OR $5::boolean)
  RETURNING o.id
)
SELECT ev.places_left, EXISTS (SELECT 1 FROM upd) AS changed, (SELECT same FROM cur) AS same FROM ev`
