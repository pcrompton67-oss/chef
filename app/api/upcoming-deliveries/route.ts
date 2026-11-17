import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'
import {
  MAX_UPCOMING_DELIVERIES,
  listUpcomingDeliveries,
  parseDeliveryInput,
  removePastDeliveries,
} from '@/lib/upcoming'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    // Past dates free up their slot for the next one.
    await removePastDeliveries()
    const deliveries = await listUpcomingDeliveries(MAX_UPCOMING_DELIVERIES)
    return NextResponse.json({ deliveries })
  } catch (error) {
    console.error('Upcoming deliveries list failed:', error)
    return NextResponse.json({ error: 'Could not load dates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = parseDeliveryInput(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    await removePastDeliveries()
    const existing = await listUpcomingDeliveries(MAX_UPCOMING_DELIVERIES + 1)
    if (existing.length >= MAX_UPCOMING_DELIVERIES) {
      return NextResponse.json(
        { error: `You can plan up to ${MAX_UPCOMING_DELIVERIES} deliveries ahead.` },
        { status: 400 },
      )
    }
    const [delivery] = await sql`
      INSERT INTO upcoming_deliveries (start_date, end_date, note)
      VALUES (${parsed.start_date}, ${parsed.end_date}, ${parsed.note})
      RETURNING id, to_char(start_date, 'YYYY-MM-DD') AS start_date,
                to_char(end_date, 'YYYY-MM-DD') AS end_date, note
    `
    return NextResponse.json({ delivery })
  } catch (error) {
    console.error('Upcoming delivery create failed:', error)
    return NextResponse.json({ error: 'Could not save the date' }, { status: 500 })
  }
}
