import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import {
  addCustomer,
  deleteCustomer,
  isValidEmail,
  listCustomers,
  normaliseEmail,
  updateCustomer,
} from '@/features/customers/lib'

export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// GET /api/customers?q=search — manager only.
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const customers = await listCustomers(q)
  return NextResponse.json({ customers })
}

// POST /api/customers — add (or re-consent) a customer by hand.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    email?: string
  }
  const name = (body.name ?? '').trim()
  const email = normaliseEmail(body.email ?? '')
  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    )
  }
  const customer = await addCustomer({ name, email })
  return NextResponse.json(customer, { status: 201 })
}

// PATCH /api/customers — edit name/email or toggle subscription.
export async function PATCH(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    name?: string
    email?: string
    subscribed?: boolean
  }
  const id = Number(body.id)
  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  if (body.email !== undefined && !isValidEmail(normaliseEmail(body.email))) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    )
  }
  try {
    const customer = await updateCustomer(id, body)
    if (!customer) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
    return NextResponse.json(customer)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('customers_email_key')) {
      return NextResponse.json(
        { error: 'Another customer already uses that email.' },
        { status: 409 },
      )
    }
    throw e
  }
}

// DELETE /api/customers?id=123
export async function DELETE(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  }
  await deleteCustomer(id)
  return NextResponse.json({ ok: true })
}
