import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { getHomeImage, saveHomeImage } from '@/lib/settings'
import { IMAGES, isUploadedPhoto } from '@/lib/event-editing'

/** Console → Settings: the photo at the top of the home page (issue #37). PIN only. */
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  return NextResponse.json({ homeImage: await getHomeImage() })
}

export async function PUT(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { homeImage?: unknown } | null
  const url = typeof body?.homeImage === 'string' ? body.homeImage.trim() : ''
  if (url && !IMAGES.some((i) => i.path === url) && !isUploadedPhoto(url))
    return NextResponse.json({ error: 'Please choose a photo from the list.' }, { status: 400 })
  return NextResponse.json({ ok: true, homeImage: await saveHomeImage(url) })
}
