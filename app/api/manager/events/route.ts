import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { listManagerEvents, parseEvent, saveEvent } from '@/lib/manager-events'

/** Console: list all Dine at Home events, drafts included. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  return NextResponse.json({ events: await listManagerEvents() })
}

/** Console: create an event (from scratch or a duplicate) with its menu and collection points. */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const parsed = parseEvent(await req.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await saveEvent({ ...parsed.event, id: null })
  return result.ok
    ? NextResponse.json(result, { status: 201 })
    : NextResponse.json(result, { status: 400 })
}
