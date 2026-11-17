import { NextResponse } from 'next/server'
import { addNotifySignup } from '@/lib/orders'

/** "Tell me about the next one" sign-up. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; locale?: unknown }
  const ok = await addNotifySignup(
    typeof body.email === 'string' ? body.email : '',
    body.locale === 'fr' ? 'fr' : 'en',
  )
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
