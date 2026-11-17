import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { MENU_CARD_MEDIA_TYPES, readMenuCard } from '@/lib/menu-card'

// Reading a card usually takes 10–30 seconds; allow up to a minute.
export const maxDuration = 60

// The browser shrinks the photo first, so a few hundred KB is normal.
const MAX_BASE64_LENGTH = 4_000_000

/** Console: read a photo of a printed menu card into a draft evening (issue #23). Saves nothing. */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { image?: unknown; mediaType?: unknown } | null
  const image = typeof body?.image === 'string' ? body.image : ''
  const mediaType = MENU_CARD_MEDIA_TYPES.find((t) => t === body?.mediaType)
  if (!image || !mediaType || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return NextResponse.json({ error: 'Please choose a photo (JPEG, PNG or WebP).' }, { status: 400 })
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'That photo is too large. Please try a smaller one.' }, { status: 413 })
  }
  const result = await readMenuCard(image, mediaType)
  return result.ok
    ? NextResponse.json({ draft: result.draft })
    : NextResponse.json({ error: result.error }, { status: result.status })
}
