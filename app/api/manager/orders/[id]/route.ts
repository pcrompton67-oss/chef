import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { applyOrderAction } from '@/lib/manager-orders'
import type { OrderAction } from '@/lib/order-editing'

/** Console: deposit received, collected, cancel, refund sent … */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as OrderAction
  const result = await applyOrderAction((await params).id, body)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
