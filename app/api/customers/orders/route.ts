import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { listCustomerOrders } from '@/features/customers/lib'

export const dynamic = 'force-dynamic'

// GET /api/customers/orders?id=123 — one customer's past orders, newest
// first. Manager only, read-only. Loaded when their row is opened.
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  const orders = await listCustomerOrders(id)
  if (!orders) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json({ orders })
}
