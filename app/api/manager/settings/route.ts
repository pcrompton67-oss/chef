import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { getBusinessSettings, saveBusinessSettings } from '@/lib/settings'

/** Console → Settings: bank details and the days allowed to pay a transfer deposit. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  return NextResponse.json({ settings: await getBusinessSettings() })
}

export async function PUT(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const settings = await saveBusinessSettings(await req.json().catch(() => null))
  return NextResponse.json({ ok: true, settings })
}
