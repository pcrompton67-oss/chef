import { NextResponse, after } from 'next/server'
import type Stripe from 'stripe'
import { emailCardOrderPaid } from '@/lib/emails'
import { cardPaymentsReady, confirmCardPayment, expireCardCheckout, readWebhook } from '@/lib/stripe'

/**
 * Stripe calls this when a card payment page is paid or closes unpaid
 * (issue #14). Set up in Stripe → Developers → Webhooks, pointing at
 * https://www.ejdineathome.com/api/stripe/webhook with the events
 * checkout.session.completed, checkout.session.async_payment_succeeded and
 * checkout.session.expired; its signing secret is STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  if (!cardPaymentsReady()) return NextResponse.json({ error: 'Card payments are not set up' }, { status: 503 })

  let event: Stripe.Event
  try {
    event = readWebhook(await req.text(), req.headers.get('stripe-signature') ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const orderId = await confirmCardPayment(event.data.object)
      if (orderId) after(() => emailCardOrderPaid(orderId))
      break
    }
    case 'checkout.session.expired':
      await expireCardCheckout(event.data.object)
      break
  }
  // Anything else is acknowledged and ignored, so Stripe doesn't keep retrying.
  return NextResponse.json({ received: true })
}
