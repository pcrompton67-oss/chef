import { NextResponse, type NextRequest } from 'next/server'
import { sendReminders } from '@/lib/emails'

/**
 * The day-before reminders, called by Vercel's scheduler (vercel.json).
 * It runs at 16:00 and 17:00 UTC so that one of the two is 18:00 in Paris
 * whatever the season; the other does nothing. Vercel proves it's calling by
 * sending CRON_SECRET, so nobody else can set it off.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }

  const parisHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date()),
  )
  if (parisHour !== 18) return NextResponse.json({ ok: true, note: `It's ${parisHour}h in Paris, not 18h: nothing to do.` })

  return NextResponse.json({ ok: true, ...(await sendReminders()) })
}
