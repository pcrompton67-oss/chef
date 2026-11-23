import { query, transaction } from '@/lib/db'
import { getEvent } from '@/lib/events'
import type { Locale } from '@/lib/i18n'
import { CARD_HOLD_MINUTES, cardPaymentsReady, type CheckoutOrder } from '@/lib/stripe'

/**
 * Placing a Dine at Home order from the website.
 *
 * Everything the form checks is checked again here. The places are taken
 * inside one transaction that first locks the event, so two people booking the
 * last places at the same moment are handled one after the other: the second
 * one sees the first one's order and is refused if there's no room left.
 *
 * A bank-transfer order keeps its places until Eleanor confirms or releases
 * it. Those places are never freed automatically: after the days set in
 * Console → Settings it is only flagged "overdue" (issue #6).
 *
 * A card order (issue #14, only when Stripe is set up) holds its places for
 * CARD_HOLD_MINUTES while the customer pays on Stripe's page; lib/stripe.ts
 * confirms it when paid, and otherwise the hold simply runs out.
 */

/** Most diners one website order can be for. */
export const MAX_DINERS = 12

export type OrderInput = {
  slug: string
  locale: Locale
  collectionPointId: string
  diners: number
  /** How many diners chose each option of the choice courses, by option id. */
  choices: Record<string, number>
  name: string
  mobile: string
  email: string
  allergies: string
  /** Anything else the customer wants Eleanor to know (optional); saved as the order's notes. */
  notes: string
  marketing: boolean
  agreed: boolean
  paymentMethod: 'card' | 'bank_transfer'
}

export type OrderResult =
  | {
      ok: true
      orderId: string
      /** For a card order: what Stripe's payment page needs. */
      checkout: CheckoutOrder | null
    }
  | {
      ok: false
      /**
       * invalid: a field is missing or wrong · choices: option counts don't add up ·
       * closed: not open or past the cut-off · not_enough: fewer places left than asked for
       */
      error: 'not_found' | 'invalid' | 'choices' | 'closed' | 'not_enough'
      field?: string
      placesLeft?: number
    }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trims a text field and caps its length; empty becomes ''. */
function clean(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function parseOrderInput(body: Record<string, unknown>): OrderInput {
  const choices: Record<string, number> = {}
  if (body.choices && typeof body.choices === 'object') {
    for (const [id, n] of Object.entries(body.choices as Record<string, unknown>)) {
      choices[id] = Number(n)
    }
  }
  return {
    slug: clean(body.slug),
    locale: body.locale === 'fr' ? 'fr' : 'en',
    collectionPointId: clean(body.collectionPointId, 20),
    diners: Number(body.diners),
    choices,
    name: clean(body.name),
    mobile: clean(body.mobile, 40),
    email: clean(body.email),
    allergies: clean(body.allergies, 1000),
    notes: clean(body.notes, 1000),
    marketing: body.marketing === true,
    agreed: body.agreed === true,
    paymentMethod: body.paymentMethod === 'card' ? 'card' : 'bank_transfer',
  }
}

export async function placeOrder(input: OrderInput): Promise<OrderResult> {
  const event = await getEvent(input.slug, input.locale)
  if (!event) return { ok: false, error: 'not_found' }
  if (event.availability === 'closed' || event.availability === 'past') {
    return { ok: false, error: 'closed' }
  }

  // The fields
  const { diners } = input
  if (!event.collectionPoints.some((p) => p.id === input.collectionPointId)) {
    return { ok: false, error: 'invalid', field: 'collectionPoint' }
  }
  if (!Number.isInteger(diners) || diners < 1 || diners > MAX_DINERS) {
    return { ok: false, error: 'invalid', field: 'diners' }
  }
  if (!input.name) return { ok: false, error: 'invalid', field: 'name' }
  if (input.mobile.replace(/\D/g, '').length < 6) {
    return { ok: false, error: 'invalid', field: 'mobile' }
  }
  if (!EMAIL.test(input.email)) return { ok: false, error: 'invalid', field: 'email' }
  if (!input.allergies) return { ok: false, error: 'invalid', field: 'allergies' }
  if (!input.agreed) return { ok: false, error: 'invalid', field: 'agreed' }
  // Card only when Stripe is set up and there is a deposit to pay.
  const card = input.paymentMethod === 'card'
  if (card && (!cardPaymentsReady() || event.depositCents <= 0)) {
    return { ok: false, error: 'invalid', field: 'paymentMethod' }
  }

  // Each choice course: the counts must be whole numbers adding up to the diners,
  // and only this event's options may be used.
  const optionIds: string[] = []
  const quantities: number[] = []
  const known = new Set<string>()
  for (const course of event.courses.filter((c) => c.kind === 'choice')) {
    let total = 0
    for (const option of course.options) {
      known.add(option.id)
      const n = input.choices[option.id] ?? 0
      if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'choices' }
      total += n
      if (n > 0) {
        optionIds.push(option.id)
        quantities.push(n)
      }
    }
    if (total !== diners) return { ok: false, error: 'choices' }
  }
  if (Object.entries(input.choices).some(([id, n]) => n > 0 && !known.has(id))) {
    return { ok: false, error: 'choices' }
  }

  const [, [result]] = await transaction([
    // 1. Lock the event: anyone else ordering for it waits here until we finish.
    { text: 'SELECT id FROM events WHERE slug = $1 FOR UPDATE', params: [input.slug] },
    // 2. Count the places again (now that nobody else can change them) and,
    //    only if there's room, save the customer, the order and its choices.
    { text: PLACE_ORDER_SQL, params: [
      input.slug,
      diners,
      input.collectionPointId,
      input.name,
      input.mobile,
      input.email,
      input.allergies,
      input.locale,
      input.marketing,
      optionIds,
      quantities,
      card ? 'card' : 'bank_transfer',
      card ? CARD_HOLD_MINUTES : null,
      input.notes || null,
    ] },
  ])

  const r = result as {
    status: string
    cutoff_passed: boolean
    is_past: boolean
    places_left: number
    order_id: string | null
  }
  if (r.order_id) {
    return {
      ok: true,
      orderId: r.order_id,
      checkout: card
        ? {
            id: r.order_id,
            slug: event.slug,
            eventTitle: event.theme,
            eventDate: event.date,
            diners,
            depositCents: event.depositCents,
            email: input.email,
            locale: input.locale,
          }
        : null,
    }
  }
  if (r.status !== 'open' || r.cutoff_passed || r.is_past) return { ok: false, error: 'closed' }
  return { ok: false, error: 'not_enough', placesLeft: r.places_left }
}

// $1 event slug · $2 diners · $3 collection point · $4 name · $5 mobile · $6 email
// $7 allergies · $8 language · $9 marketing consent · $10 option ids · $11 quantities
// $12 payment method · $13 minutes the places are held (card), or null (bank transfer: until Eleanor acts)
// $14 the customer's notes, or null
const PLACE_ORDER_SQL = `
WITH ev AS (
  SELECT e.id, e.status, e.is_test, e.price_cents, e.deposit_cents,
         e.cutoff_at < now() AS cutoff_passed,
         e.event_date < (now() AT TIME ZONE 'Europe/Paris')::date AS is_past,
         GREATEST(e.capacity - COALESCE((
           SELECT sum(o.diners) FROM orders o
            WHERE o.event_id = e.id
              AND (o.status = 'confirmed'
                   OR (o.status IN ('held', 'awaiting_transfer')
                       AND (o.hold_expires_at IS NULL OR o.hold_expires_at > now())))
         ), 0), 0)::int AS places_left
    FROM events e
   WHERE e.slug = $1::text
),
ok AS (
  SELECT * FROM ev
   WHERE status = 'open' AND NOT cutoff_passed AND NOT is_past AND places_left >= $2::int
),
-- One customer per email. Ticking the marketing box gives consent; leaving it
-- unticked doesn't take away consent given before.
cust AS (
  INSERT INTO customers (name, email, mobile, language, marketing_consent, consent_at, source, is_test)
  SELECT $4::text, $6::text, $5::text, $8::text, $9::boolean,
         CASE WHEN $9::boolean THEN now() END, 'website', ok.is_test
    FROM ok
  ON CONFLICT (lower(email)) DO UPDATE
     SET name = EXCLUDED.name,
         mobile = EXCLUDED.mobile,
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
                      total_cents, deposit_cents, balance_cents, hold_expires_at, is_test)
  SELECT ok.id, $3::bigint, cust.id, $2::int, $4::text, $5::text, $6::text,
         $7::text, $14::text, $8::text, 'website', $12::text, 'held',
         ok.price_cents * $2::int, ok.deposit_cents * $2::int,
         (ok.price_cents - ok.deposit_cents) * $2::int,
         now() + make_interval(mins => $13::int), ok.is_test
    FROM ok, cust
  RETURNING id
),
lines AS (
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  SELECT ord.id, x.option_id, x.quantity
    FROM ord, unnest($10::bigint[], $11::int[]) AS x(option_id, quantity)
)
SELECT ev.status, ev.cutoff_passed, ev.is_past, ev.places_left,
       (SELECT id::text FROM ord) AS order_id
  FROM ev`

/** A card order whose payment page couldn't be opened: it expires straight away, freeing its places. */
export async function abandonCardOrder(orderId: string): Promise<void> {
  await query(
    `UPDATE orders SET status = 'expired', updated_at = now()
      WHERE id = $1 AND payment_method = 'card' AND status = 'held' AND deposit_paid_at IS NULL`,
    [orderId],
  )
}

/**
 * For the thank-you page after a card order: is it paid ('paid'), still
 * waiting for Stripe ('pending'), or did the payment not go through
 * ('unpaid': the payment page was left or ran out)? Null if this isn't a
 * website card order for this evening.
 */
export async function cardOrderState(
  eventSlug: string,
  orderId: string,
): Promise<'paid' | 'pending' | 'unpaid' | null> {
  if (!/^\d{1,10}$/.test(orderId)) return null
  const [row] = await query<{ status: string; paid: boolean; live: boolean }>(
    `SELECT o.status, o.deposit_paid_at IS NOT NULL AS paid,
            (o.hold_expires_at IS NULL OR o.hold_expires_at > now()) AS live
       FROM orders o JOIN events e ON e.id = o.event_id
      WHERE o.id = $1 AND e.slug = $2 AND o.payment_method = 'card' AND o.source = 'website'`,
    [orderId, eventSlug],
  )
  if (!row) return null
  if (row.paid && row.status === 'confirmed') return 'paid'
  if (row.status === 'held' && row.live) return 'pending'
  return 'unpaid'
}

/**
 * For the thank-you page: the deposit still to be paid by bank transfer on
 * this order, or null if there is none (already paid, cancelled, another
 * payment method, or not an order for this evening). Only the amount is
 * returned, never who ordered, since the address only carries the order number.
 */
export async function transferDepositDue(eventSlug: string, orderId: string): Promise<number | null> {
  if (!/^\d{1,10}$/.test(orderId)) return null
  const [row] = await query<{ depositCents: number }>(
    `SELECT o.deposit_cents AS "depositCents" FROM orders o JOIN events e ON e.id = o.event_id
      WHERE o.id = $1 AND e.slug = $2 AND o.payment_method = 'bank_transfer'
        AND o.status IN ('held', 'awaiting_transfer') AND o.deposit_paid_at IS NULL AND o.deposit_cents > 0`,
    [orderId, eventSlug],
  )
  return row ? row.depositCents : null
}
