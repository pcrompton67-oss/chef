import { query, transaction } from '@/lib/db'
import {
  IMAGES,
  isUploadedMenu,
  isUploadedPhoto,
  STATUSES,
  type EditableCourse,
  type EditableEvent,
  type EditablePoint,
  type EventFacts,
  type ManagerStatus,
} from '@/lib/event-editing'

export { STATUSES, type ManagerStatus }

/**
 * Events as Eleanor edits them in the console (/manager → Events).
 * Unlike lib/events.ts this includes drafts and collection addresses, so it
 * must only ever be used behind the manager PIN.
 */

export type EventListItem = {
  id: string
  slug: string
  title: string
  date: string
  status: ManagerStatus
  isTest: boolean
  capacity: number
  placesTaken: number
  orderCount: number
}

// Orders that count against capacity (same rule as the public pages).
const TAKES_PLACES = `(o.status = 'confirmed'
  OR (o.status IN ('held', 'awaiting_transfer')
      AND (o.hold_expires_at IS NULL OR o.hold_expires_at > now())))`

export async function listManagerEvents(): Promise<EventListItem[]> {
  return query<EventListItem>(
    `SELECT e.id::text, e.slug, e.title, e.event_date::text AS date, e.status,
            e.is_test AS "isTest", e.capacity,
            COALESCE((SELECT sum(o.diners) FROM orders o
                       WHERE o.event_id = e.id AND ${TAKES_PLACES}), 0)::int AS "placesTaken",
            (SELECT count(*) FROM orders o
              WHERE o.event_id = e.id AND o.status NOT IN ('cancelled', 'expired'))::int AS "orderCount"
       FROM events e
      WHERE e.kind = 'dine_at_home'
      ORDER BY e.event_date DESC, e.id DESC`,
  )
}

export async function getManagerEvent(
  id: string,
): Promise<{ event: EditableEvent; facts: EventFacts } | null> {
  if (!/^\d+$/.test(id)) return null
  const [row] = await query<Omit<EditableEvent, 'courses' | 'collectionPoints'>>(
    `SELECT id::text, slug, title, COALESCE(theme, '') AS theme, event_date::text AS date,
            COALESCE(intro, '') AS intro, COALESCE(title_fr, '') AS "titleFr",
            COALESCE(theme_fr, '') AS "themeFr", COALESCE(intro_fr, '') AS "introFr",
            COALESCE(hero_image, '') AS "heroImage",
            COALESCE(menu_image, '') AS "menuImage", COALESCE(menu_image_fr, '') AS "menuImageFr",
            COALESCE(second_image, '') AS "secondImage", price_cents AS "priceCents",
            deposit_cents AS "depositCents", capacity,
            to_char(cutoff_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI') AS "cutoffAt",
            status, is_test AS "isTest"
       FROM events WHERE id = $1 AND kind = 'dine_at_home'`,
    [id],
  )
  if (!row) return null

  const [courses, points, facts] = await Promise.all([
    query<EditableCourse>(
      `SELECT c.id::text, c.name, COALESCE(c.name_fr, '') AS "nameFr", c.kind,
              COALESCE(c.description, '') AS description,
              COALESCE(c.description_fr, '') AS "descriptionFr",
              COALESCE(json_agg(json_build_object(
                'id', o.id::text, 'name', o.name, 'nameFr', COALESCE(o.name_fr, ''),
                'vegetarian', o.vegetarian,
                'description', COALESCE(o.description, ''))
                ORDER BY o.position) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
         FROM courses c LEFT JOIN course_options o ON o.course_id = c.id
        WHERE c.event_id = $1
        GROUP BY c.id ORDER BY c.position`,
      [id],
    ),
    query<EditablePoint>(
      `SELECT id::text, place, to_char(collect_time, 'HH24:MI') AS time, address
         FROM collection_points WHERE event_id = $1 ORDER BY collect_time, position`,
      [id],
    ),
    query<EventFacts>(
      `SELECT
         COALESCE((SELECT sum(o.diners) FROM orders o
                    WHERE o.event_id = $1 AND ${TAKES_PLACES}), 0)::int AS "placesTaken",
         (SELECT count(*) FROM orders o
           WHERE o.event_id = $1 AND o.status NOT IN ('cancelled', 'expired'))::int AS "orderCount",
         ARRAY(SELECT DISTINCT l.course_option_id::text FROM order_lines l
                 JOIN orders o ON o.id = l.order_id WHERE o.event_id = $1) AS "usedOptionIds",
         ARRAY(SELECT DISTINCT collection_point_id::text FROM orders
                WHERE event_id = $1) AS "usedPointIds"`,
      [id],
    ),
  ])

  return { event: { ...row, courses, collectionPoints: points }, facts: facts[0] }
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN)

/** Turns whatever the browser sent into a tidy event, or explains what's wrong. */
export function parseEvent(body: unknown): { event: EditableEvent } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const courses = Array.isArray(b.courses) ? b.courses : []
  const points = Array.isArray(b.collectionPoints) ? b.collectionPoints : []
  const id = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? v : null)

  const event: EditableEvent = {
    id: id(b.id),
    slug: text(b.slug),
    title: text(b.title),
    theme: text(b.theme),
    date: text(b.date),
    intro: text(b.intro),
    titleFr: text(b.titleFr),
    themeFr: text(b.themeFr),
    introFr: text(b.introFr),
    heroImage: text(b.heroImage),
    secondImage: text(b.secondImage),
    menuImage: text(b.menuImage),
    menuImageFr: text(b.menuImageFr),
    priceCents: int(b.priceCents),
    depositCents: int(b.depositCents),
    capacity: int(b.capacity),
    cutoffAt: text(b.cutoffAt),
    status: STATUSES.includes(b.status as ManagerStatus) ? (b.status as ManagerStatus) : 'draft',
    isTest: b.isTest === true,
    courses: courses.map((c: Record<string, unknown>) => ({
      id: id(c?.id),
      name: text(c?.name),
      nameFr: text(c?.nameFr),
      kind: c?.kind === 'choice' ? 'choice' : 'fixed',
      description: text(c?.description),
      descriptionFr: text(c?.descriptionFr),
      options: (Array.isArray(c?.options) ? c.options : []).map((o: Record<string, unknown>) => ({
        id: id(o?.id),
        name: text(o?.name),
        nameFr: text(o?.nameFr),
        vegetarian: o?.vegetarian === true,
        description: text(o?.description),
      })),
    })),
    collectionPoints: points.map((p: Record<string, unknown>) => ({
      id: id(p?.id),
      place: text(p?.place),
      time: text(p?.time),
      address: text(p?.address),
    })),
  }

  const e = event
  if (!e.title) return { error: 'Please give the evening a title.' }
  if (!SLUG.test(e.slug))
    return { error: 'The web address may only use small letters, numbers and dashes (e.g. inspired-by-india).' }
  if (!DATE.test(e.date) || isNaN(Date.parse(e.date))) return { error: 'Please choose the date.' }
  if (!DATETIME.test(e.cutoffAt) || isNaN(Date.parse(e.cutoffAt)))
    return { error: 'Please set the last day and time for orders.' }
  if (e.cutoffAt.slice(0, 10) > e.date) return { error: 'The order cut-off must be before the evening.' }
  if (!(e.priceCents >= 0)) return { error: 'Please enter the price per person.' }
  if (!(e.depositCents >= 0)) return { error: 'Please enter the deposit per person (0 if none).' }
  if (e.depositCents > e.priceCents) return { error: 'The deposit can’t be more than the price.' }
  if (!(e.capacity > 0)) return { error: 'Please enter how many diners you can cater for.' }
  const known = (img: string) => IMAGES.some((i) => i.path === img) || isUploadedPhoto(img)
  for (const img of [e.heroImage, e.secondImage]) {
    if (img && !known(img)) return { error: 'Please choose a photo from the list.' }
  }
  for (const m of [e.menuImage, e.menuImageFr]) {
    if (m && !known(m) && !isUploadedMenu(m)) return { error: 'Please upload the printed menu again.' }
  }

  for (const [i, c] of e.courses.entries()) {
    const label = c.name || `Course ${i + 1}`
    if (!c.name) return { error: `Course ${i + 1} needs a name (e.g. Starter).` }
    if (c.options.some((o) => !o.name)) return { error: `Every dish in “${label}” needs a name.` }
    if (c.kind === 'fixed' && c.options.length !== 1)
      return { error: `“${label}” is the same for everyone, so it needs exactly one dish.` }
    if (c.kind === 'choice' && c.options.length < 2)
      return { error: `“${label}” is a choice, so it needs at least two dishes.` }
  }
  for (const [i, p] of e.collectionPoints.entries()) {
    if (!p.place || !p.address || !TIME.test(p.time))
      return { error: `Collection point ${i + 1} needs a place, a time and an address.` }
  }
  if (e.status !== 'draft' && (!e.courses.length || !e.collectionPoints.length))
    return { error: 'An evening needs at least one course and one collection point before it can be published.' }

  return { event }
}

/**
 * Creates (id null) or updates an event together with its whole menu and
 * collection points, all in one go: either everything is saved or nothing is.
 */
export async function saveEvent(e: EditableEvent): Promise<SaveResult> {
  const [clash] = await query(
    `SELECT 1 FROM events WHERE slug = $1 AND id IS DISTINCT FROM $2::bigint`,
    [e.slug, e.id],
  )
  if (clash) return { ok: false, error: 'Another evening already uses that web address. Please choose another.' }

  let isTest = e.isTest
  if (e.id) {
    const existing = await getManagerEvent(e.id)
    if (!existing) return { ok: false, error: 'This evening no longer exists.' }
    // Test or real is fixed when the evening is created, so a real evening
    // (and its orders) can never be turned into a deletable test one.
    isTest = existing.event.isTest

    const { facts, event: old } = existing
    if (e.capacity < facts.placesTaken)
      return { ok: false, error: `${facts.placesTaken} places are already taken, so the capacity can’t be lower than that.` }

    const keptOptions = new Set(e.courses.flatMap((c) => c.options.map((o) => o.id)))
    const keptPoints = new Set(e.collectionPoints.map((p) => p.id))
    for (const c of old.courses) {
      for (const o of c.options) {
        if (facts.usedOptionIds.includes(o.id!) && !keptOptions.has(o.id))
          return { ok: false, error: `“${o.name}” has already been ordered, so it can’t be removed.` }
      }
    }
    for (const p of old.collectionPoints) {
      if (facts.usedPointIds.includes(p.id!) && !keptPoints.has(p.id))
        return { ok: false, error: `Customers are collecting from ${p.place}, so it can’t be removed.` }
    }
  }

  // After the first statement, the event is found by its (new) web address.
  const EV = `(SELECT id FROM events WHERE slug = $1)`
  const fields = [
    e.slug, e.title, e.theme || null, e.date, e.intro || null, e.heroImage || null,
    e.menuImage || null, e.priceCents, e.depositCents, e.capacity, e.cutoffAt, e.status,
    e.titleFr || null, e.themeFr || null, e.introFr || null,
    e.menuImageFr || null, e.secondImage || null,
  ]
  const cutoff = `($11::timestamp AT TIME ZONE 'Europe/Paris')`
  const statements: { text: string; params?: unknown[] }[] = [
    e.id
      ? {
          text: `UPDATE events SET slug = $1, title = $2, theme = $3, event_date = $4, intro = $5,
                   hero_image = $6, menu_image = $7, price_cents = $8, deposit_cents = $9,
                   capacity = $10, cutoff_at = ${cutoff}, status = $12,
                   title_fr = $13, theme_fr = $14, intro_fr = $15,
                   menu_image_fr = $16, second_image = $17, updated_at = now()
                 WHERE id = $18`,
          params: [...fields, e.id],
        }
      : {
          text: `INSERT INTO events (slug, title, theme, event_date, intro, hero_image, menu_image,
                   price_cents, deposit_cents, capacity, cutoff_at, status,
                   title_fr, theme_fr, intro_fr, menu_image_fr, second_image, is_test)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${cutoff}, $12, $13, $14, $15, $16, $17, $18)`,
          params: [...fields, isTest],
        },
  ]

  const keptCourseIds = e.courses.map((c) => c.id).filter(Boolean)
  const keptOptionIds = e.courses.flatMap((c) => c.options.map((o) => o.id)).filter(Boolean)
  const keptPointIds = e.collectionPoints.map((p) => p.id).filter(Boolean)

  if (e.id) {
    // Remove what Eleanor deleted, then move everything out of the way so the
    // new order can be written without two rows sharing a position.
    statements.push(
      {
        text: `DELETE FROM course_options o USING courses c
                WHERE o.course_id = c.id AND c.event_id = ${EV} AND NOT (o.id = ANY($2::bigint[]))`,
        params: [e.slug, keptOptionIds],
      },
      {
        text: `DELETE FROM courses WHERE event_id = ${EV} AND NOT (id = ANY($2::bigint[]))`,
        params: [e.slug, keptCourseIds],
      },
      {
        text: `DELETE FROM collection_points WHERE event_id = ${EV} AND NOT (id = ANY($2::bigint[]))`,
        params: [e.slug, keptPointIds],
      },
      { text: `UPDATE courses SET position = position + 10000 WHERE event_id = ${EV}`, params: [e.slug] },
      {
        text: `UPDATE course_options SET position = position + 10000
                WHERE course_id IN (SELECT id FROM courses WHERE event_id = ${EV})`,
        params: [e.slug],
      },
      { text: `UPDATE collection_points SET position = position + 10000 WHERE event_id = ${EV}`, params: [e.slug] },
    )
  }

  e.courses.forEach((c, ci) => {
    const pos = ci + 1
    statements.push(
      c.id
        ? {
            text: `UPDATE courses SET position = $2, name = $3, kind = $4, description = $5,
                      name_fr = $6, description_fr = $7
                    WHERE id = $8 AND event_id = ${EV}`,
            params: [e.slug, pos, c.name, c.kind, c.description || null, c.nameFr || null, c.descriptionFr || null, c.id],
          }
        : {
            text: `INSERT INTO courses (event_id, position, name, kind, description, name_fr, description_fr)
                   VALUES (${EV}, $2, $3, $4, $5, $6, $7)`,
            params: [e.slug, pos, c.name, c.kind, c.description || null, c.nameFr || null, c.descriptionFr || null],
          },
    )
    const COURSE = `(SELECT id FROM courses WHERE event_id = ${EV} AND position = $2)`
    c.options.forEach((o, oi) => {
      statements.push(
        o.id
          ? {
              text: `UPDATE course_options SET position = $3, name = $4, vegetarian = $5, description = $6,
                        name_fr = $7
                      WHERE id = $8 AND course_id = ${COURSE}`,
              params: [e.slug, pos, oi + 1, o.name, o.vegetarian, o.description || null, o.nameFr || null, o.id],
            }
          : {
              text: `INSERT INTO course_options (course_id, position, name, vegetarian, description, name_fr)
                     VALUES (${COURSE}, $3, $4, $5, $6, $7)`,
              params: [e.slug, pos, oi + 1, o.name, o.vegetarian, o.description || null, o.nameFr || null],
            },
      )
    })
  })

  // Collection points are kept in time order.
  const points = [...e.collectionPoints].sort((a, b) => a.time.localeCompare(b.time))
  points.forEach((p, pi) => {
    statements.push(
      p.id
        ? {
            text: `UPDATE collection_points SET position = $2, place = $3, collect_time = $4, address = $5
                    WHERE id = $6 AND event_id = ${EV}`,
            params: [e.slug, pi + 1, p.place, p.time, p.address, p.id],
          }
        : {
            text: `INSERT INTO collection_points (event_id, position, place, collect_time, address)
                   VALUES (${EV}, $2, $3, $4, $5)`,
            params: [e.slug, pi + 1, p.place, p.time, p.address],
          },
    )
  })

  statements.push({ text: `SELECT id::text FROM events WHERE slug = $1`, params: [e.slug] })

  try {
    const results = await transaction(statements)
    const last = results[results.length - 1][0] as { id: string }
    return { ok: true, id: last.id }
  } catch (err) {
    console.error('saveEvent failed', err)
    return { ok: false, error: 'Something went wrong while saving. Nothing was changed; please try again.' }
  }
}

/** Changes only the status (open, close, sold out, …). */
export async function setStatus(id: string, status: ManagerStatus): Promise<SaveResult> {
  const found = await getManagerEvent(id)
  if (!found) return { ok: false, error: 'This evening no longer exists.' }
  const { courses, collectionPoints } = found.event
  if (status !== 'draft' && (!courses.length || !collectionPoints.length))
    return { ok: false, error: 'Add at least one course and one collection point first.' }
  await query(`UPDATE events SET status = $2, updated_at = now() WHERE id = $1`, [id, status])
  return { ok: true, id }
}

/**
 * Deletes an evening. A TEST evening goes with all its orders. A real evening can only be
 * deleted while it is still a draft and has never had an order (not even a cancelled one),
 * so nothing a customer saw or booked is ever lost.
 */
export async function deleteEvent(id: string): Promise<SaveResult> {
  if (!/^\d+$/.test(id)) return { ok: false, error: 'Not found.' }
  const results = await transaction([
    {
      text: `DELETE FROM orders WHERE event_id = (SELECT id FROM events WHERE id = $1 AND is_test)`,
      params: [id],
    },
    {
      text: `DELETE FROM events e
              WHERE e.id = $1
                AND (e.is_test
                     OR (e.status = 'draft'
                         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.event_id = e.id)))
              RETURNING e.id::text`,
      params: [id],
    },
  ])
  if (!results[1].length)
    return {
      ok: false,
      error: 'Only test evenings, or real evenings that are still drafts with no orders, can be deleted.',
    }
  return { ok: true, id }
}
