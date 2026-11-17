import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { getEmailSettings, recentEmails, saveEmailSettings, sendingEnabled } from '@/lib/emails'

/** Console → Emails: settings, whether sending is set up, and the recent log. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const [settings, log] = await Promise.all([getEmailSettings(), recentEmails()])
  return NextResponse.json({
    settings,
    log,
    sending: sendingEnabled(),
    remindersReady: Boolean(process.env.CRON_SECRET),
  })
}

/** Console → Emails: save the reminders switch. */
export async function PUT(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const settings = await saveEmailSettings(await req.json().catch(() => null))
  return NextResponse.json({ ok: true, settings })
}
