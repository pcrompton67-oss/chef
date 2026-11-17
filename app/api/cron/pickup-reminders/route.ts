import { NextResponse, type NextRequest } from 'next/server'
import {
  getRemindersEnabled,
  isSendHour,
  parisTomorrow,
  sendPickupReminders,
} from '@/features/pickup-reminders/lib'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Called by Vercel Cron (see vercel.json). It is scheduled at both 16:00 and
// 17:00 UTC because 18:00 in France is one or the other depending on summer
// time; whichever run lands in the 18:00 Paris hour sends, the other skips.
export async function GET(req: NextRequest) {
  // With CRON_SECRET set, Vercel sends it as a Bearer token and we require it.
  // Without one, fall back to Vercel's cron user agent. That header can be
  // spoofed, but the guards below (toggle, 18:00-Paris window, once-per-day
  // send log) mean a forged call can only do what the schedule would anyway.
  const secret = process.env.CRON_SECRET
  const authorized = secret
    ? req.headers.get('authorization') === `Bearer ${secret}`
    : (req.headers.get('user-agent') ?? '').startsWith('vercel-cron')
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await getRemindersEnabled())) {
    return NextResponse.json({ skipped: 'Pickup reminders are switched off.' })
  }
  if (!isSendHour()) {
    return NextResponse.json({ skipped: 'Not 18:00 in France yet.' })
  }
  const result = await sendPickupReminders(parisTomorrow(), 'cron')
  return NextResponse.json(result)
}
