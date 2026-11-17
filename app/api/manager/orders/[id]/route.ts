import { NextResponse, after, type NextRequest } from 'next/server'
import { emailBookingConfirmed } from '@/lib/emails'
import { checkRequestPin } from '@/lib/pins'
import { applyOrderAction } from '@/lib/manager-orders'
import type { OrderAction } from '@/lib/order-editing'

/** Console: deposit received, collected, cancel, refund sent … */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as OrderAction
  const id = (await params).id
  const result = await applyOrderAction(id, body)
  // Deposit received: the customer gets their confirmation, with the address.
  if (result.ok && body.action === 'deposit_received') after(() => emailBookingConfirmed(id))
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
