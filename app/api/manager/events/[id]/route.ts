import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import {
  STATUSES,
  deleteEvent,
  getManagerEvent,
  parseEvent,
  saveEvent,
  setStatus,
  type ManagerStatus,
} from '@/lib/manager-events'

type Ctx = { params: Promise<{ id: string }> }
const denied = () => NextResponse.json({ error: 'PIN required' }, { status: 401 })

/** Console: one event with its menu, collection addresses and order facts. */
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!checkRequestPin(req, 'manager')) return denied()
  const found = await getManagerEvent((await params).id)
  return found
    ? NextResponse.json(found)
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/** Console: save the whole event. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!checkRequestPin(req, 'manager')) return denied()
  const parsed = parseEvent(await req.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await saveEvent({ ...parsed.event, id: (await params).id })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

/** Console: change only the status. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!checkRequestPin(req, 'manager')) return denied()
  const body = (await req.json().catch(() => ({}))) as { status?: string }
  if (!STATUSES.includes(body.status as ManagerStatus))
    return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
  const result = await setStatus((await params).id, body.status as ManagerStatus)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

/** Console: delete a test evening (with its orders) or a real draft with no orders. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!checkRequestPin(req, 'manager')) return denied()
  const result = await deleteEvent((await params).id)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
