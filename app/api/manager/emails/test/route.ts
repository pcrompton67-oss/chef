import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { sendTestEmail } from '@/lib/emails'
import { OWNER_EMAIL } from '@/lib/site'

/** Console → Emails → "Send me a test": one customer email, made-up order, the wording on screen, to Eleanor. */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { kind?: unknown; locale?: unknown; wording?: unknown } | null
  const status = await sendTestEmail(body?.kind, body?.locale, body?.wording)
  if (status === 'invalid') return NextResponse.json({ error: 'Unknown email.' }, { status: 400 })
  if (status === 'sent') return NextResponse.json({ ok: true, message: `Test sent to ${OWNER_EMAIL}.` })
  if (status === 'skipped')
    return NextResponse.json({ error: 'Emails aren’t being sent yet (no Resend key), so no test could go out.' }, { status: 503 })
  return NextResponse.json({ error: 'The test email couldn’t be sent. Please try again.' }, { status: 502 })
}
