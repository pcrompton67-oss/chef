import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { deleteCustomer, listCustomers, mailingListCsv, unsubscribeCustomer } from '@/lib/customers'

/** Console → Customers: everyone, or (?format=csv) the mailing list as a spreadsheet. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  if (req.nextUrl.searchParams.get('format') === 'csv') {
    return new NextResponse(await mailingListCsv(), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="mailing-list.csv"',
        'cache-control': 'no-store',
      },
    })
  }
  return NextResponse.json({ customers: await listCustomers() })
}

/** Take someone off the mailing list, or erase them completely (issue #34). */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown }
  if (body.action === 'delete' && typeof body.id === 'string') {
    const result = await deleteCustomer(body.id)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }
  if (body.action !== 'unsubscribe' || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  const ok = await unsubscribeCustomer(body.id)
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: 'Customer not found' }, { status: 404 })
}
