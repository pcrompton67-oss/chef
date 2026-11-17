import { connection } from 'next/server'
import { query } from '@/lib/db'

/**
 * Reading Dine at Home events for the public pages.
 * Drafts are never returned. Collection-point addresses are deliberately
 * NOT selected here, so they can never reach a public page.
 */

export type EventStatus = 'open' | 'sold_out' | 'closed' | 'done'

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
  menuImage: string | null
  cutoffAt: string // ISO timestamp
  courses: {
    name: string
    kind: 'fixed' | 'choice'
    description: string | null
    options: { name: string; vegetarian: boolean }[]
  }[]
  collectionPoints: { place: string; time: string }[] // time as HH:MM
}

type EventRow = {
  id: string
  slug: string
  title: string
  theme: string | null
  date: string
  intro: string | null
  hero_image: string | null
  menu_image: string | null
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
  e.hero_image, e.menu_image, e.price_cents, e.deposit_cents, e.status, e.is_test,
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

function toSummary(r: EventRow): EventSummary {
  return {
    slug: r.slug,
    title: r.title,
    theme: r.theme || r.title,
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
export async function listEvents(): Promise<{ upcoming: EventSummary[]; past: EventSummary[] }> {
  await connection()
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events e
      WHERE e.kind = 'dine_at_home' AND e.status <> 'draft'
      ORDER BY e.event_date`,
  )
  const all = rows.map(toSummary)
  return {
    upcoming: all.filter((e) => e.availability !== 'past'),
    past: all.filter((e) => e.availability === 'past').reverse(),
  }
}

/** One published event with its menu and collection times, or null. */
export async function getEvent(slug: string): Promise<EventDetail | null> {
  await connection()
  const [row] = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events e
      WHERE e.slug = $1 AND e.kind = 'dine_at_home' AND e.status <> 'draft'`,
    [slug],
  )
  if (!row) return null

  const [courseRows, pointRows] = await Promise.all([
    query<{
      name: string
      kind: 'fixed' | 'choice'
      description: string | null
      options: { name: string; vegetarian: boolean }[]
    }>(
      `SELECT c.name, c.kind, c.description,
              COALESCE(json_agg(json_build_object('name', o.name, 'vegetarian', o.vegetarian)
                                ORDER BY o.position) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
         FROM courses c LEFT JOIN course_options o ON o.course_id = c.id
        WHERE c.event_id = $1
        GROUP BY c.id ORDER BY c.position`,
      [row.id],
    ),
    query<{ place: string; time: string }>(
      `SELECT place, to_char(collect_time, 'HH24:MI') AS time
         FROM collection_points WHERE event_id = $1 ORDER BY position`,
      [row.id],
    ),
  ])

  return {
    ...toSummary(row),
    intro: row.intro,
    menuImage: row.menu_image,
    cutoffAt: row.cutoff_at,
    courses: courseRows,
    collectionPoints: pointRows,
  }
}
