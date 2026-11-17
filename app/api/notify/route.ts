import { NextResponse } from 'next/server'
import { addSignup } from '@/lib/customers'

/** "Tell me about the next one" sign-up (joins the mailing list). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; locale?: unknown; event?: unknown }
  const ok = await addSignup(
    typeof body.email === 'string' ? body.email : '',
    body.locale === 'fr' ? 'fr' : 'en',
    typeof body.event === 'string' ? body.event : '',
  )
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
