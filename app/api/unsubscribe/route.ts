import { NextResponse, type NextRequest } from 'next/server'
import { unsubscribeByToken } from '@/lib/customers'

/**
 * Unsubscribe from the mailing list. Used by the button on /unsubscribe, and
 * by email apps' own "Unsubscribe" button (one-click, code in the address).
 */
export async function POST(req: NextRequest) {
  let token = req.nextUrl.searchParams.get('t') ?? ''
  if (!token && req.headers.get('content-type')?.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown }
    if (typeof body.token === 'string') token = body.token
  }
  const ok = await unsubscribeByToken(token)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
