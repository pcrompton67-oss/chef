import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { suggestFrench } from '@/lib/email-french'

// A translation usually takes a few seconds; allow up to a minute.
export const maxDuration = 60

/** Console → Emails → "Suggest French": Claude's French for Eleanor's English wording. Saves nothing. */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { texts?: unknown } | null
  const result = await suggestFrench(body?.texts)
  return result.ok
    ? NextResponse.json({ french: result.french })
    : NextResponse.json({ error: result.error }, { status: result.status })
}
