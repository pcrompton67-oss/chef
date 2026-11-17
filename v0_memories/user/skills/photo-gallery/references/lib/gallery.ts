import { sql } from '@/lib/db'
import { MAX_HERO_PHOTOS, type GalleryPhoto } from '@/lib/gallery-shared'

export { MAX_HERO_PHOTOS, type GalleryPhoto }

export async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
  const rows = await sql`
    SELECT id, url, pathname, caption, is_hero, sort_order, created_at
    FROM gallery_photos
    ORDER BY sort_order ASC, created_at DESC
  `
  return rows as GalleryPhoto[]
}

export async function listHeroPhotos(): Promise<GalleryPhoto[]> {
  const rows = await sql`
    SELECT id, url, pathname, caption, is_hero, sort_order, created_at
    FROM gallery_photos
    WHERE is_hero = true
    ORDER BY sort_order ASC, created_at DESC
    LIMIT ${MAX_HERO_PHOTOS}
  `
  return rows as GalleryPhoto[]
}
