import { NextResponse, type NextRequest } from 'next/server'
import { isValidEmail, signUpFromWebsite } from '@/features/customers/lib'
import { buildSignupEmail } from '@/features/customers/signup-email'
import { sendInBulk } from '@/lib/bulk-email'

export const dynamic = 'force-dynamic'

function siteUrlFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return `${proto}://${host}`
}

// POST /api/customers/signup — public "remind me" box on the home page.
// The reply is the same whether or not the address was already on the list,
// so the form can't be used to find out who our customers are.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown
    name?: unknown
    website?: unknown
    locale?: unknown
  }
  // Spam trap: a field people never see. Bots that fill it in are quietly
  // told "thanks" and nothing is saved.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!email || email.length > 200 || !isValidEmail(email.toLowerCase())) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  const locale = body.locale === 'fr' ? 'fr' : 'en'
  const added = await signUpFromWebsite({ name, email })
  if (added) {
    // Best effort: the sign-up stands even if the email can't go out.
    await sendInBulk(
      [{ to: added.email, ...buildSignupEmail(added, siteUrlFrom(req), locale) }],
      async () => {},
      'signup',
    ).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
