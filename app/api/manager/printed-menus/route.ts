import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { photosConfigured } from '@/lib/photos'
import { uploadPrintedMenu } from '@/lib/printed-menus'

/**
 * Console → Events: upload a printed menu (issue #37). Body: the PDF, or the
 * photo shrunk in the browser; `?language=en|fr`. Returns its web address,
 * which the evening stores when it is saved. PIN only.
 */
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return NextResponse.json({ error: 'PIN required' }, { status: 401 })
  if (!photosConfigured())
    return NextResponse.json({ error: 'Uploads aren’t set up yet (no Blob store connected in Vercel).' }, { status: 400 })
  const language = req.nextUrl.searchParams.get('language') === 'fr' ? 'fr' : 'en'
  const result = await uploadPrintedMenu(new Uint8Array(await req.arrayBuffer()), language)
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : 400 })
}
