import { del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { MAX_HERO_PHOTOS } from '@/lib/gallery'
import { checkRequestPin } from '@/lib/pins'

type Params = { params: Promise<{ id: string }> }

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid photo' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as {
    caption?: unknown
    is_hero?: unknown
  }

  if (typeof body.is_hero === 'boolean' && body.is_hero) {
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM gallery_photos
      WHERE is_hero = true AND id <> ${id}
    `
    if (count >= MAX_HERO_PHOTOS) {
      return NextResponse.json(
        {
          error: `You can show up to ${MAX_HERO_PHOTOS} photos on the home page. Remove one first.`,
        },
        { status: 400 },
      )
    }
  }

  const caption =
    typeof body.caption === 'string' ? body.caption.trim().slice(0, 200) : null
  const isHero = typeof body.is_hero === 'boolean' ? body.is_hero : null

  const [photo] = await sql`
    UPDATE gallery_photos SET
      caption = COALESCE(${caption}, caption),
      is_hero = COALESCE(${isHero}, is_hero)
    WHERE id = ${id}
    RETURNING id, url, pathname, caption, is_hero, sort_order, created_at
  `
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  return NextResponse.json({ photo })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid photo' }, { status: 400 })

  const [photo] = await sql`
    DELETE FROM gallery_photos WHERE id = ${id} RETURNING url
  `
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  try {
    await del(photo.url as string)
  } catch (error) {
    // The record is already gone, so the photo no longer shows anywhere;
    // a leftover file in storage is harmless.
    console.error('Gallery file delete failed:', error)
  }
  return NextResponse.json({ ok: true })
}
