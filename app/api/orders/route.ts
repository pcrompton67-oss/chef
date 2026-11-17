import { NextResponse, after, type NextRequest } from 'next/server'
import { emailNewWebsiteOrder } from '@/lib/emails'
import { abandonCardOrder, parseOrderInput, placeOrder } from '@/lib/orders'
import { startCardCheckout } from '@/lib/stripe'

/**
 * Places a Dine at Home order from the website form.
 * Bank transfer: the order is saved and the "request received" emails go out.
 * Card (issue #14): the order is saved and the answer carries the address of
 * Stripe's payment page; the emails go out once it's paid (lib/stripe.ts).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

  const result = await placeOrder(parseOrderInput(body))
  if (!result.ok) {
    const status =
      result.error === 'not_found' ? 404 : result.error === 'closed' || result.error === 'not_enough' ? 409 : 400
    return NextResponse.json(result, { status })
  }

  const { orderId, checkout } = result
  if (checkout) {
    try {
      const checkoutUrl = await startCardCheckout(checkout, req.nextUrl.origin)
      return NextResponse.json({ ok: true, orderId, checkoutUrl }, { status: 201 })
    } catch (err) {
      console.error('Opening the Stripe payment page failed', err)
      await abandonCardOrder(orderId)
      return NextResponse.json({ ok: false, error: 'payment' }, { status: 502 })
    }
  }

  // Emails go out after the customer has their answer, so they never slow it down.
  after(() => emailNewWebsiteOrder(orderId))
  return NextResponse.json({ ok: true, orderId }, { status: 201 })
}
