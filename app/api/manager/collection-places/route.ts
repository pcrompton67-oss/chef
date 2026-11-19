import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { listCollectionPlaces, parsePlaces, saveCollectionPlaces } from '@/lib/collection-places'

/** Console: the master list of collection places (issue #35). PIN only: it holds addresses. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  return NextResponse.json({ places: await listCollectionPlaces() })
}

export async function PUT(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const parsed = parsePlaces(await req.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  return NextResponse.json({ ok: true, places: await saveCollectionPlaces(parsed.places) })
}
