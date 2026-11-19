import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { getEmailWording, saveEmailWording } from '@/lib/emails'
import { frenchSuggestionsReady } from '@/lib/email-french'

/** Console → Emails: Eleanor's own opening, closing and sign-off for the customer emails (issue #36). */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  return NextResponse.json({ wording: await getEmailWording(), frenchReady: frenchSuggestionsReady() })
}

export async function PUT(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const wording = await saveEmailWording(await req.json().catch(() => null))
  return NextResponse.json({ ok: true, wording })
}
