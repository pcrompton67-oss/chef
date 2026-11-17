import { type NextRequest, NextResponse } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { getBanner, parseBannerInput, saveBanner } from '@/lib/banner'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    return NextResponse.json({ banner: await getBanner() })
  } catch (error) {
    console.error('Banner load failed:', error)
    return NextResponse.json({ error: 'Could not load the banner' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const parsed = parseBannerInput(await req.json().catch(() => ({})))
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  try {
    return NextResponse.json({ banner: await saveBanner(parsed) })
  } catch (error) {
    console.error('Banner save failed:', error)
    return NextResponse.json({ error: 'Could not save the banner' }, { status: 500 })
  }
}
