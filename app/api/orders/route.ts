import { NextResponse, after } from 'next/server'
import { emailNewWebsiteOrder } from '@/lib/emails'
import { parseOrderInput, placeOrder } from '@/lib/orders'

/** Places a Dine at Home order from the website form. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

  const result = await placeOrder(parseOrderInput(body))
  // Emails go out after the customer has their answer, so they never slow it down.
  if (result.ok) after(() => emailNewWebsiteOrder(result.orderId))
  const status = result.ok
    ? 201
    : result.error === 'not_found'
      ? 404
      : result.error === 'closed' || result.error === 'not_enough'
        ? 409
        : 400
  return NextResponse.json(result, { status })
}
