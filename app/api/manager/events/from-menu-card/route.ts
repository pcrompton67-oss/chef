import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { MENU_CARD_MEDIA_TYPES, readMenuCard, type MenuCardFile } from '@/lib/menu-card'

// Reading a card usually takes 10–30 seconds (two cards a little longer); allow up to two minutes.
export const maxDuration = 120

// Vercel accepts about 4.5 MB per request. Photos are shrunk in the browser
// (a few hundred KB); PDFs are sent as they are, so they're what can be too big.
const MAX_TOTAL_BASE64 = 4_300_000

/**
 * Console: read one or two printed menu cards (an English and/or a French
 * one, each a photo or a PDF) into a draft evening (issues #23, #33). Saves nothing.
 */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { cards?: unknown } | null
  const raw = Array.isArray(body?.cards) ? (body.cards as Record<string, unknown>[]) : []

  const cards: MenuCardFile[] = []
  for (const c of raw) {
    const language = c?.language === 'fr' ? 'fr' : c?.language === 'en' ? 'en' : null
    const mediaType = MENU_CARD_MEDIA_TYPES.find((t) => t === c?.mediaType)
    const data = typeof c?.data === 'string' ? c.data : ''
    if (!language || !mediaType || !data || !/^[A-Za-z0-9+/=]+$/.test(data) || cards.some((x) => x.language === language)) {
      return NextResponse.json({ error: 'Please choose a photo or PDF of the menu card.' }, { status: 400 })
    }
    cards.push({ language, mediaType, data })
  }
  if (cards.length === 0 || cards.length > 2) {
    return NextResponse.json({ error: 'Please choose a photo or PDF of the menu card.' }, { status: 400 })
  }
  if (cards.reduce((n, c) => n + c.data.length, 0) > MAX_TOTAL_BASE64) {
    return NextResponse.json(
      { error: 'Those files are too large to send (about 3 MB in all at most). Please try a photo instead of a PDF.' },
      { status: 413 },
    )
  }

  const result = await readMenuCard(cards)
  return result.ok
    ? NextResponse.json({ draft: result.draft })
    : NextResponse.json({ error: result.error }, { status: result.status })
}
