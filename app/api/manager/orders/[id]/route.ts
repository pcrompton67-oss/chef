import { NextResponse, after, type NextRequest } from 'next/server'
import { emailBookingConfirmed, emailOrderChanged, orderBeforeChange } from '@/lib/emails'
import { checkRequestPin } from '@/lib/pins'
import { applyOrderAction, changeOrder } from '@/lib/manager-orders'
import type { OrderAction } from '@/lib/order-editing'
import { refundCardOrder } from '@/lib/stripe'

/** Console: deposit received, collected, cancel, refund sent … */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as OrderAction
  const id = (await params).id
  // A card refund goes back through Stripe (issue #14).
  if (body.action === 'refund_card') {
    const refund = await refundCardOrder(id)
    return NextResponse.json(refund, { status: refund.ok ? 200 : 400 })
  }
  const result = await applyOrderAction(id, body)
  // Deposit received: the customer gets their confirmation, with the address.
  if (result.ok && body.action === 'deposit_received') after(() => emailBookingConfirmed(id))
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

/**
 * Console: change an order (diners, dishes, collection point, contact …; issue #21).
 * With `notify` ticked, the customer is emailed what changed (issue #40).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const id = (await params).id
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const before = body?.notify === true ? await orderBeforeChange(id, body.language) : null
  const result = await changeOrder(id, body)
  if (result.ok && before) after(() => emailOrderChanged(id, before))
  return NextResponse.json(result, { status: result.ok ? 200 : result.overCapacity ? 409 : 400 })
}
