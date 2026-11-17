import { sql } from '@/lib/db'
import { EMPTY_BANNER, type SiteBanner } from '@/lib/banner-shared'

export * from '@/lib/banner-shared'

export async function getBanner(): Promise<SiteBanner> {
  const [row] = await sql`
    SELECT is_active, title, message, to_char(ends_on, 'YYYY-MM-DD') AS ends_on
    FROM site_banner WHERE id = 1
  `
  return (row as SiteBanner | undefined) ?? EMPTY_BANNER
}

// The banner shows while it is switched on and its end date (French time) has not passed.
export async function getVisibleBanner(): Promise<SiteBanner | null> {
  const [row] = await sql`
    SELECT is_active, title, message, to_char(ends_on, 'YYYY-MM-DD') AS ends_on
    FROM site_banner
    WHERE id = 1
      AND is_active = true
      AND (title <> '' OR message <> '')
      AND (ends_on IS NULL OR ends_on >= (now() AT TIME ZONE 'Europe/Paris')::date)
  `
  return (row as SiteBanner | undefined) ?? null
}

export async function saveBanner(banner: SiteBanner): Promise<SiteBanner> {
  const [row] = await sql`
    INSERT INTO site_banner (id, is_active, title, message, ends_on, updated_at)
    VALUES (1, ${banner.is_active}, ${banner.title}, ${banner.message}, ${banner.ends_on}, now())
    ON CONFLICT (id) DO UPDATE SET
      is_active = EXCLUDED.is_active,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      ends_on = EXCLUDED.ends_on,
      updated_at = now()
    RETURNING is_active, title, message, to_char(ends_on, 'YYYY-MM-DD') AS ends_on
  `
  return row as SiteBanner
}
