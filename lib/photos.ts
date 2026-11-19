/**
 * Eleanor's own photos (issue #20), kept in Vercel Blob under event-photos/.
 * The console shrinks each photo to a JPEG before it is sent, so what is
 * stored is already web-sized. Needs BLOB_READ_WRITE_TOKEN (added by Vercel
 * when a Blob store is connected to the project). PIN-only: see the API route.
 */
import { del, list, put } from '@vercel/blob'
import { query } from '@/lib/db'
import { getHomeImage } from '@/lib/settings'
import { PHOTO_FOLDER, isUploadedPhoto, type UploadedPhoto } from '@/lib/event-editing'

const MAX_BYTES = 4 * 1024 * 1024
// Give up rather than leave the console waiting if storage doesn't answer
// (the Blob library keeps retrying and doesn't always honour abortSignal).
function withTimeout<T>(work: Promise<T>, ms = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('photo storage didn’t answer in time')), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

export function photosConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** Every uploaded photo, newest first. */
export async function listPhotos(): Promise<UploadedPhoto[]> {
  const photos: UploadedPhoto[] = []
  let cursor: string | undefined
  do {
    const page = await withTimeout(list({ prefix: PHOTO_FOLDER, cursor, limit: 1000 }))
    for (const b of page.blobs) photos.push({ url: b.url, uploadedAt: new Date(b.uploadedAt).toISOString() })
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return photos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export type PhotoResult = { ok: true; photo: UploadedPhoto } | { ok: false; error: string }

/** Stores one JPEG (already shrunk in the browser). */
export async function uploadPhoto(bytes: ArrayBuffer): Promise<PhotoResult> {
  const b = new Uint8Array(bytes)
  if (b.length === 0) return { ok: false, error: 'No photo was received. Please try again.' }
  if (b.length > MAX_BYTES) return { ok: false, error: 'That photo is too large. Please try a different one.' }
  if (b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff)
    return { ok: false, error: 'That file couldn’t be read as a photo. Please choose a JPEG or PNG photo.' }
  try {
    const blob = await withTimeout(put(`${PHOTO_FOLDER}photo.jpg`, Buffer.from(b), {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/jpeg',
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    }), 30_000)
    return { ok: true, photo: { url: blob.url, uploadedAt: new Date().toISOString() } }
  } catch (err) {
    console.error('Photo upload failed', err)
    return { ok: false, error: `The photo couldn’t be saved (${err instanceof Error ? err.message : 'storage error'}).` }
  }
}

/** Removes a photo, unless an evening still uses it. */
export async function deletePhoto(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUploadedPhoto(url)) return { ok: false, error: 'That photo wasn’t found.' }
  const users = await query<{ title: string }>(
    `SELECT title FROM events
      WHERE $1 IN (hero_image, menu_image, menu_image_fr, second_image) ORDER BY event_date`,
    [url],
  )
  if ((await getHomeImage()) === url) users.push({ title: 'the home page (Settings)' })
  if (users.length)
    return {
      ok: false,
      error: `This photo is still used by: ${users.map((u) => u.title).join(', ')}. Choose another photo there first.`,
    }
  try {
    await withTimeout(del(url))
    return { ok: true }
  } catch (err) {
    console.error('Photo delete failed', err)
    return { ok: false, error: 'The photo couldn’t be deleted. Please try again.' }
  }
}
