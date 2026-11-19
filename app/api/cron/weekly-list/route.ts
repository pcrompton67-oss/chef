import { NextResponse, type NextRequest } from 'next/server'
import { sendWeeklyList, sendWeeklySummary } from '@/lib/emails'

/**
 * Eleanor's two Monday emails, sent separately: the weekly mailing list and the
 * summary of live evenings (issue #44). Eleanor's weekly mailing-list email, called by Vercel's scheduler
 * (vercel.json) on Mondays at 06:00 and 07:00 UTC, so that one of the two is
 * 8:00 in Paris whatever the season; the other does nothing. Vercel proves
 * it's calling by sending CRON_SECRET, so nobody else can set it off.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }

  const parisHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date()),
  )
  if (parisHour !== 8) return NextResponse.json({ ok: true, note: `It's ${parisHour}h in Paris, not 8h: nothing to do.` })

  // Each is sent on its own, so one failing doesn't stop the other.
  const [list, summary] = await Promise.allSettled([sendWeeklyList(), sendWeeklySummary()])
  const outcome = (r: PromiseSettledResult<{ status: string }>) =>
    r.status === 'fulfilled' ? r.value.status : `error: ${String(r.reason)}`
  return NextResponse.json({ ok: true, list: outcome(list), summary: outcome(summary) })
}
