import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { liveEvenings } from '@/lib/overview'

/** Console → Events: live evenings at a glance (issue #44), test evenings included. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  return NextResponse.json({ evenings: await liveEvenings({ includeTest: true }) })
}
