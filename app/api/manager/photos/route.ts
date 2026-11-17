import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { deletePhoto, listPhotos, photosConfigured, uploadPhoto } from '@/lib/photos'

/** Console → Events: Eleanor's uploaded photos (issue #20). PIN only. */
const NOT_SET_UP = 'Photo uploads aren’t set up yet (no Blob store connected in Vercel).'

export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  if (!photosConfigured()) return NextResponse.json({ configured: false, photos: [] })
  try {
    return NextResponse.json({ configured: true, photos: await listPhotos() })
  } catch (err) {
    console.error('Photo list failed', err)
    return NextResponse.json({ configured: true, photos: [], error: 'Your uploaded photos couldn’t be loaded.' })
  }
}

/** Body: the JPEG itself (image/jpeg), already shrunk in the browser. */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  if (!photosConfigured()) return NextResponse.json({ error: NOT_SET_UP }, { status: 400 })
  const result = await uploadPhoto(await req.arrayBuffer())
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : 400 })
}

export async function DELETE(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  if (!photosConfigured()) return NextResponse.json({ error: NOT_SET_UP }, { status: 400 })
  const url = req.nextUrl.searchParams.get('url') ?? ''
  const result = await deletePhoto(url)
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : 400 })
}
