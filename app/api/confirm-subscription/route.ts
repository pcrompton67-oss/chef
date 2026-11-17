import { NextResponse } from 'next/server'
import { confirmSignup } from '@/lib/customers'

/** The button on /confirm-subscription: puts them on the mailing list. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown }
  const ok = await confirmSignup(typeof body.token === 'string' ? body.token : '')
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
