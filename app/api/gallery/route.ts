import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { listGalleryPhotos } from '@/lib/gallery'
import { checkRequestPin } from '@/lib/pins'

export const dynamic = 'force-dynamic'

// Vercel functions accept request bodies up to 4.5 MB; the console shrinks
// photos in the browser first, so this only trips on unusual files.
const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export async function GET() {
  try {
    const photos = await listGalleryPhotos()
    return NextResponse.json({ photos })
  } catch (error) {
    console.error('Gallery list failed:', error)
    return NextResponse.json({ error: 'Could not load photos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let file: File | null = null
  let caption = ''
  try {
    const form = await req.formData()
    const value = form.get('file')
    file = value instanceof File ? value : null
    caption = String(form.get('caption') ?? '').trim().slice(0, 200)
  } catch {
    return NextResponse.json({ error: 'Photo is too large' }, { status: 413 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Please upload a JPG, PNG or WebP photo' },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Photo is too large' }, { status: 413 })
  }

  try {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const blob = await put(`gallery/photo.${ext}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })
    const [photo] = await sql`
      INSERT INTO gallery_photos (url, pathname, caption, sort_order)
      VALUES (
        ${blob.url},
        ${blob.pathname},
        ${caption},
        COALESCE((SELECT MIN(sort_order) - 1 FROM gallery_photos), 0)
      )
      RETURNING id, url, pathname, caption, is_hero, sort_order, created_at
    `
    return NextResponse.json({ photo })
  } catch (error) {
    console.error('Gallery upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
