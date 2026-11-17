import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { addManualOrder, listOrders } from '@/lib/manager-orders'

/** Console: all orders for one evening (?event=ID). */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const orders = await listOrders(req.nextUrl.searchParams.get('event') ?? '')
  return orders
    ? NextResponse.json({ orders })
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/** Console: add an order Eleanor took herself (phone, WhatsApp, in person …). */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const result = await addManualOrder(await req.json().catch(() => null))
  return NextResponse.json(result, { status: result.ok ? 201 : result.overCapacity ? 409 : 400 })
}
