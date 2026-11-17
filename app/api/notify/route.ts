import { after, NextResponse } from 'next/server'
import { requestSignup } from '@/lib/customers'
import { emailSignupConfirmation } from '@/lib/emails'

/**
 * A sign-up box (home page, or "tell me about the next one" on a sold-out
 * evening). Sends the confirmation email; they join the mailing list only
 * once they click its link (/confirm-subscription).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; locale?: unknown; event?: unknown }
  const locale = body.locale === 'fr' ? 'fr' : 'en'
  const res = await requestSignup(
    typeof body.email === 'string' ? body.email : '',
    locale,
    typeof body.event === 'string' ? body.event : '',
  )
  if (res.ok && res.send) after(() => emailSignupConfirmation(res.email, locale, res.token))
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 })
}
