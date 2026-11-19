import { connection } from 'next/server'
import { query } from '@/lib/db'
import type { Locale } from '@/lib/i18n'

/**
 * Reading Dine at Home events for the public pages.
 * Drafts are never returned. Collection-point addresses are deliberately
 * NOT selected here, so they can never reach a public page.
 *
 * On the French site (issue #12) the evening's own wording (title, theme,
 * intro, course and dish names) is the French version where Eleanor has
 * entered one, and the English otherwise.
 */

export type EventStatus = 'open' | 'sold_out' | 'closed' | 'done'

/** At or below this many places left, pages say "Only X places left". */
export const LOW_PLACES = 8

/** What a visitor sees: can they still order, and how many places are left. */
export type Availability = 'open' | 'sold_out' | 'closed' | 'past'

export type EventSummary = {
  slug: string
  title: string
  theme: string
  date: string // YYYY-MM-DD (Paris)
  heroImage: string | null
  priceCents: number
  depositCents: number
  placesLeft: number
  availability: Availability
  isTest: boolean
}

export type EventDetail = EventSummary & {
  intro: string | null
  /** The printed menu (photo or PDF) for this language, falling back to the other one (issue #37). */
  menuImage: string | null
  /** The photo further down the page; null = the site's usual one (issue #37). */
  secondImage: string | null
  cutoffAt: string // ISO timestamp
  courses: {
    id: string
    name: string
    kind: 'fixed' | 'choice'
    description: string | null
    options: { id: string; name: string; vegetarian: boolean }[]
  }[]
  collectionPoints: { id: string; place: string; time: string }[] // time as HH:MM
}

type EventRow = {
  id: string
  slug: string
  title: string
  theme: string | null
  date: string
  intro: string | null
  title_fr: string | null
  theme_fr: string | null
  intro_fr: string | null
  hero_image: string | null
  menu_image: string | null
  menu_image_fr: string | null
  second_image: string | null
  price_cents: number
  deposit_cents: number
  status: EventStatus
  is_test: boolean
  cutoff_at: string
  cutoff_passed: boolean
  is_past: boolean
  places_left: number
}

// Places are taken by confirmed orders, and by unpaid orders whose hold has
// not yet run out.
const EVENT_COLUMNS = `
  e.id::text, e.slug, e.title, e.theme, e.event_date::text AS date, e.intro,
  e.title_fr, e.theme_fr, e.intro_fr,
  e.hero_image, e.menu_image, e.menu_image_fr, e.second_image, e.price_cents, e.deposit_cents, e.status, e.is_test,
  to_char(e.cutoff_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS cutoff_at,
  e.cutoff_at < now() AS cutoff_passed,
  e.event_date < (now() AT TIME ZONE 'Europe/Paris')::date AS is_past,
  GREATEST(e.capacity - COALESCE((
    SELECT sum(o.diners) FROM orders o
     WHERE o.event_id = e.id
       AND (o.status = 'confirmed'
            OR (o.status IN ('held', 'awaiting_transfer')
                AND (o.hold_expires_at IS NULL OR o.hold_expires_at > now())))
  ), 0), 0)::int AS places_left`

function availability(r: EventRow): Availability {
  if (r.status === 'done' || r.is_past) return 'past'
  if (r.status === 'sold_out' || r.places_left <= 0) return 'sold_out'
  if (r.status === 'closed' || r.cutoff_passed) return 'closed'
  return 'open'
}

/** The French wording when on the French site and Eleanor entered one; otherwise the English. */
function pick(en: string, fr: string | null | undefined, locale: Locale): string
function pick(en: string | null, fr: string | null | undefined, locale: Locale): string | null
function pick(en: string | null, fr: string | null | undefined, locale: Locale): string | null {
  return locale === 'fr' && fr?.trim() ? fr : en
}

function toSummary(r: EventRow, locale: Locale): EventSummary {
  const title = pick(r.title, r.title_fr, locale)
  // A French title with no French theme shows the French title, not the English theme.
  const theme = locale === 'fr' && r.title_fr?.trim() && !r.theme_fr?.trim() ? null : pick(r.theme, r.theme_fr, locale)
  return {
    slug: r.slug,
    title,
    theme: theme || title,
    date: r.date,
    heroImage: r.hero_image,
    priceCents: r.price_cents,
    depositCents: r.deposit_cents,
    placesLeft: r.places_left,
    availability: availability(r),
    isTest: r.is_test,
  }
}

/** All published Dine at Home events, split into upcoming (soonest first) and past (latest first). */
export async function listEvents(locale: Locale = 'en'): Promise<{ upcoming: EventSummary[]; past: EventSummary[] }> {
  await connection()
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events e
      WHERE e.kind = 'dine_at_home' AND e.status <> 'draft'
      ORDER BY e.event_date`,
  )
  const all = rows.map((r) => toSummary(r, locale))
  return {
    upcoming: all.filter((e) => e.availability !== 'past'),
    past: all.filter((e) => e.availability === 'past').reverse(),
  }
}

/** One published event with its menu and collection times, or null. */
export async function getEvent(slug: string, locale: Locale = 'en'): Promise<EventDetail | null> {
  await connection()
  const [row] = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events e
      WHERE e.slug = $1 AND e.kind = 'dine_at_home' AND e.status <> 'draft'`,
    [slug],
  )
  if (!row) return null

  const [courseRows, pointRows] = await Promise.all([
    query<{
      id: string
      name: string
      name_fr: string | null
      kind: 'fixed' | 'choice'
      description: string | null
      description_fr: string | null
      options: { id: string; name: string; name_fr: string | null; vegetarian: boolean }[]
    }>(
      `SELECT c.id::text, c.name, c.name_fr, c.kind, c.description, c.description_fr,
              COALESCE(json_agg(json_build_object('id', o.id::text, 'name', o.name, 'name_fr', o.name_fr,
                                                  'vegetarian', o.vegetarian)
                                ORDER BY o.position) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
         FROM courses c LEFT JOIN course_options o ON o.course_id = c.id
        WHERE c.event_id = $1
        GROUP BY c.id ORDER BY c.position`,
      [row.id],
    ),
    query<{ id: string; place: string; time: string }>(
      `SELECT id::text, place, to_char(collect_time, 'HH24:MI') AS time
         FROM collection_points WHERE event_id = $1 ORDER BY position`,
      [row.id],
    ),
  ])

  return {
    ...toSummary(row, locale),
    intro: pick(row.intro, row.intro_fr, locale),
    menuImage:
      locale === 'fr' ? row.menu_image_fr || row.menu_image || null : row.menu_image || row.menu_image_fr || null,
    secondImage: row.second_image || null,
    cutoffAt: row.cutoff_at,
    courses: courseRows.map((c) => ({
      id: c.id,
      name: pick(c.name, c.name_fr, locale),
      kind: c.kind,
      description: pick(c.description, c.description_fr, locale),
      options: c.options.map((o) => ({ id: o.id, name: pick(o.name, o.name_fr, locale), vegetarian: o.vegetarian })),
    })),
    collectionPoints: pointRows,
  }
}
