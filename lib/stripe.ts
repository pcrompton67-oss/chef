import Stripe from 'stripe'
import { query } from '@/lib/db'
import { formatDate, localePath, type Locale } from '@/lib/i18n'

/**
 * Card deposits with Stripe Checkout (issue #14). Server only.
 *
 * Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (set in Vercel). Without
 * both, card payment is switched off everywhere: the order form only offers
 * bank transfer and nothing here is called.
 *
 * How a card order goes:
 * 1. The website order is saved as "held" with payment method "card", and its
 *    places are held for CARD_HOLD_MINUTES (lib/orders.ts).
 * 2. The customer is sent to Stripe's payment page for deposit × diners.
 * 3. When they have paid, Stripe tells us (the webhook, app/api/stripe/webhook)
 *    and the order is confirmed; the thank-you page also checks with Stripe,
 *    so it's confirmed even if the webhook is slow. Emails go out once.
 * 4. If they don't pay, Stripe ends the payment page after 30 minutes and the
 *    order expires. Its places are free once the hold runs out in any case.
 * 5. Refunds of a cancelled card order go back through Stripe from the console.
 */

/** How long a card order holds its places. Stripe's payment page closes a little earlier. */
export const CARD_HOLD_MINUTES = 36
const CHECKOUT_MINUTES = 31 // Stripe's minimum is 30

export function cardPaymentsReady(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

let client: Stripe | null = null
function stripe(): Stripe {
  if (!client) {
    // Only for trying things out on a computer: send Stripe calls to a stand-in.
    const local = process.env.NODE_ENV !== 'production' ? process.env.STRIPE_LOCAL_STANDIN : undefined
    const [host, port] = local ? local.split(':') : []
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, local ? { host, port, protocol: 'http' } : {})
  }
  return client
}

/* ---------- Starting a payment ---------- */

export type CheckoutOrder = {
  id: string
  slug: string
  eventTitle: string
  eventDate: string
  diners: number
  depositCents: number // per person
  email: string
  locale: Locale
}

/**
 * Opens Stripe's payment page for an order's deposit and returns its address.
 * `origin` is this website's address (so preview sites come back to themselves).
 */
export async function startCardCheckout(o: CheckoutOrder, origin: string): Promise<string> {
  const thankYou = `${origin}${localePath(`/dine-at-home/${o.slug}/thank-you`, o.locale)}?ref=${o.id}`
  const product =
    o.locale === 'fr'
      ? `Acompte · ${o.eventTitle} · ${formatDate(o.eventDate, 'fr')}`
      : `Deposit · ${o.eventTitle} · ${formatDate(o.eventDate, 'en')}`
  const session = await stripe().checkout.sessions.create(
    {
      mode: 'payment',
      allowed_payment_method_types: ['card'], // cards, plus Apple Pay / Google Pay
      line_items: [
        {
          quantity: o.diners,
          price_data: { currency: 'eur', unit_amount: o.depositCents, product_data: { name: product } },
        },
      ],
      customer_email: o.email,
      locale: o.locale,
      client_reference_id: o.id,
      metadata: { order_id: o.id },
      payment_intent_data: {
        description: `Order ${o.id} · ${o.eventTitle} · ${o.eventDate}`,
        metadata: { order_id: o.id },
      },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
      success_url: `${thankYou}&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${thankYou}&payment=cancelled`,
    },
    { idempotencyKey: `checkout-${o.id}` },
  )
  // Remember which payment page belongs to the order (replaced by the payment id once paid).
  await query(`UPDATE orders SET payment_reference = $2, updated_at = now() WHERE id = $1`, [o.id, session.id])
  if (!session.url) throw new Error('Stripe returned no payment page address')
  return session.url
}

/* ---------- Payment finished (webhook or thank-you page) ---------- */

/**
 * Confirms the order a paid Stripe payment page belongs to. Returns the order
 * id if it was confirmed just now (so the caller sends the emails), null if
 * it isn't paid, isn't ours, or was already confirmed.
 */
export async function confirmCardPayment(session: Stripe.Checkout.Session): Promise<string | null> {
  const orderId = session.metadata?.order_id
  if (session.payment_status !== 'paid' || !orderId || !/^\d+$/.test(orderId)) return null
  const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  // Only the payment page we opened for this order, for the right amount, confirms it.
  // If it was paid after the hold ran out (very unlikely), it's still confirmed (the
  // money was taken) with a note for Eleanor to check the places.
  const rows = await query<{ id: string }>(
    `UPDATE orders
        SET status = 'confirmed', deposit_paid_at = now(), hold_expires_at = NULL,
            payment_reference = COALESCE($3, payment_reference),
            notes = CASE WHEN status = 'expired' OR hold_expires_at < now()
                         THEN concat_ws(E'\\n', notes, 'Card deposit paid after the 30-minute hold ran out: please check there is still room.')
                         ELSE notes END,
            updated_at = now()
      WHERE id = $1 AND payment_method = 'card' AND payment_reference = $2
        AND deposit_paid_at IS NULL AND status IN ('held', 'expired')
        AND deposit_cents = $4
      RETURNING id::text`,
    [orderId, session.id, paymentId ?? null, session.amount_total ?? -1],
  )
  if (rows.length) return rows[0].id

  // Paid for an order Eleanor cancelled meanwhile: record the payment and mark
  // it "refund to send", so she can refund the card from the console.
  const refunds = await query(
    `UPDATE orders
        SET deposit_paid_at = now(), payment_reference = COALESCE($3, payment_reference),
            refund_status = 'requested', refund_cents = refund_cents + deposit_cents,
            notes = concat_ws(E'\\n', notes, 'Card deposit paid after the order was cancelled: please refund it.'),
            updated_at = now()
      WHERE id = $1 AND payment_method = 'card' AND payment_reference = $2
        AND deposit_paid_at IS NULL AND status = 'cancelled'
      RETURNING id`,
    [orderId, session.id, paymentId ?? null],
  )
  if (!refunds.length) {
    const [o] = await query(`SELECT 1 FROM orders WHERE id = $1 AND payment_reference IN ($2, $3)`, [
      orderId,
      session.id,
      paymentId ?? '',
    ])
    // Already confirmed (both the webhook and the thank-you page got here) is normal.
    if (!o) console.error('Stripe payment does not match an order', { orderId, session: session.id })
  }
  return null
}

/** The payment page closed without payment: the order expires and its places are free. */
export async function expireCardCheckout(session: Stripe.Checkout.Session): Promise<void> {
  await query(
    `UPDATE orders SET status = 'expired', updated_at = now()
      WHERE payment_method = 'card' AND payment_reference = $1 AND status = 'held' AND deposit_paid_at IS NULL`,
    [session.id],
  )
}

/** Checks a webhook call really comes from Stripe, and reads it. Throws if not. */
export function readWebhook(body: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
}

/** For the thank-you page: asks Stripe about a payment page, and confirms the order if it's paid. */
export async function checkCardPayment(sessionId: string): Promise<{ confirmedNow: string | null }> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { confirmedNow: null }
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    return { confirmedNow: await confirmCardPayment(session) }
  } catch (err) {
    console.error('Checking a Stripe payment failed', err)
    return { confirmedNow: null }
  }
}

/* ---------- Refunds (console) ---------- */

export type RefundResult = { ok: true; refundedCents: number } | { ok: false; error: string }

/**
 * Refunds a cancelled card order's deposit through Stripe and records it.
 * Anything paid another way (e.g. a balance paid in cash) stays "to send" by hand.
 */
export async function refundCardOrder(orderId: string): Promise<RefundResult> {
  if (!cardPaymentsReady()) return { ok: false, error: 'Card payments aren’t set up (Stripe keys missing in Vercel).' }
  const [o] = await query<{ ref: string; deposit: number; refund: number; paid: boolean }>(
    `SELECT payment_reference AS ref, deposit_cents AS deposit, refund_cents AS refund,
            deposit_paid_at IS NOT NULL AS paid
       FROM orders
      WHERE id = $1 AND payment_method = 'card' AND status = 'cancelled'
        AND refund_status IN ('requested', 'partial')`,
    [orderId],
  )
  if (!o) return { ok: false, error: 'That can’t be done for this order any more. Please refresh the page.' }
  if (!o.paid || !o.ref?.startsWith('pi_'))
    return { ok: false, error: 'This order wasn’t paid through the website, so it can’t be refunded by card here. Please refund it yourself, then press “Refund sent”.' }

  const amount = Math.min(o.refund, o.deposit)
  let refundId: string
  try {
    const refund = await stripe().refunds.create(
      { payment_intent: o.ref, amount, metadata: { order_id: orderId } },
      { idempotencyKey: `refund-${orderId}-${amount}` },
    )
    refundId = refund.id
  } catch (err) {
    console.error('Stripe refund failed', err)
    const message = err instanceof Stripe.errors.StripeError ? err.message : ''
    return { ok: false, error: `Stripe didn’t accept the refund${message ? `: ${message}` : ''}. Nothing was changed.` }
  }

  const rest = o.refund - amount
  await query(
    `UPDATE orders
        SET refund_status = CASE WHEN $2::int > 0 THEN 'partial' ELSE 'refunded' END,
            refund_cents = CASE WHEN $2::int > 0 THEN $2::int ELSE refund_cents END,
            notes = concat_ws(E'\\n', notes, $3::text),
            updated_at = now()
      WHERE id = $1`,
    [orderId, rest, `Card refund of €${(amount / 100).toFixed(2)} sent through Stripe (${refundId}).`],
  )
  return { ok: true, refundedCents: amount }
}
