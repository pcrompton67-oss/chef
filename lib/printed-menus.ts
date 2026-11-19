/**
 * Printed menus (issue #37): the PDF or photo of Eleanor's printed menu for
 * an evening, one per language, kept in Vercel Blob under printed-menus/.
 * Uploaded from Console → Events, or kept automatically from the cards given
 * to "New evening from menu card". Needs a connected Blob store, like photos (photosConfigured).
 * Files aren't deleted when an evening stops using them (they're small).
 */
import { put } from '@vercel/blob'
import { MENU_FOLDER } from '@/lib/event-editing'

/** Vercel accepts about 4.5 MB per request, so a little under that. */
export const MAX_MENU_BYTES = 4 * 1024 * 1024

export type MenuUpload = { ok: true; url: string } | { ok: false; error: string }

const KINDS = [
  { type: 'application/pdf', ext: 'pdf', starts: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: 'image/jpeg', ext: 'jpg', starts: [0xff, 0xd8, 0xff] },
  { type: 'image/png', ext: 'png', starts: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/webp', ext: 'webp', starts: [0x52, 0x49, 0x46, 0x46] }, // RIFF
] as const

/** Stores one printed menu (a PDF, or a photo already shrunk in the browser). */
export async function uploadPrintedMenu(bytes: Uint8Array, language: 'en' | 'fr'): Promise<MenuUpload> {
  if (bytes.length === 0) return { ok: false, error: 'No file was received. Please try again.' }
  if (bytes.length > MAX_MENU_BYTES)
    return { ok: false, error: 'That file is too large (about 3 MB at most for a PDF). Please try a smaller PDF or a photo.' }
  const kind = KINDS.find((k) => k.starts.every((b, i) => bytes[i] === b))
  if (!kind) return { ok: false, error: 'That file couldn’t be read. Please choose a PDF or a photo of the menu.' }
  try {
    const blob = await Promise.race([
      put(`${MENU_FOLDER}menu-${language}.${kind.ext}`, Buffer.from(bytes), {
        access: 'public',
        addRandomSuffix: true,
        contentType: kind.type,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('storage didn’t answer in time')), 30_000)),
    ])
    return { ok: true, url: blob.url }
  } catch (err) {
    console.error('Printed menu upload failed', err)
    return { ok: false, error: `The menu couldn’t be saved (${err instanceof Error ? err.message : 'storage error'}).` }
  }
}
