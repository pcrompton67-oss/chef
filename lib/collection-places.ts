import { query, transaction } from '@/lib/db'
import type { CollectionPlace } from '@/lib/event-editing'

/*
 * Console → Settings → Collection places (issue #35): the master list of
 * places customers can collect from. Evenings copy place, time and address
 * from here when they are created, so changes here never alter an existing
 * evening. Addresses are PIN-only: nothing public reads this table.
 */

export async function listCollectionPlaces(): Promise<CollectionPlace[]> {
  return query<CollectionPlace>(
    `SELECT id::text, place, address, to_char(usual_time, 'HH24:MI') AS time,
            in_new_events AS "inNewEvents"
       FROM collection_places
      ORDER BY usual_time, lower(place), id`,
  )
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Checks the list sent from the console. */
export function parsePlaces(body: unknown): { places: CollectionPlace[] } | { error: string } {
  const list = (body as { places?: unknown } | null)?.places
  if (!Array.isArray(list)) return { error: 'Nothing to save.' }
  const places: CollectionPlace[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const r = (raw ?? {}) as Record<string, unknown>
    const p: CollectionPlace = {
      id: typeof r.id === 'string' && /^\d+$/.test(r.id) ? r.id : null,
      place: String(r.place ?? '').trim(),
      address: String(r.address ?? '').trim(),
      time: String(r.time ?? '').trim(),
      inNewEvents: r.inNewEvents !== false,
    }
    if (!p.place) return { error: 'Every collection place needs a name.' }
    if (!p.address) return { error: `Please add the exact address for ${p.place}.` }
    if (!TIME.test(p.time)) return { error: `Please add the usual collection time for ${p.place}.` }
    const key = p.place.toLowerCase()
    if (seen.has(key)) return { error: `${p.place} is in the list twice.` }
    seen.add(key)
    places.push(p)
  }
  return { places }
}

/** Saves the whole list in one go: updates, additions and removals. */
export async function saveCollectionPlaces(places: CollectionPlace[]): Promise<CollectionPlace[]> {
  const keep = places.filter((p) => p.id).map((p) => p.id)
  await transaction([
    { text: `DELETE FROM collection_places WHERE NOT (id::text = ANY($1::text[]))`, params: [keep] },
    ...places.map((p) =>
      p.id
        ? {
            text: `UPDATE collection_places
                      SET place = $2, address = $3, usual_time = $4, in_new_events = $5, updated_at = now()
                    WHERE id = $1`,
            params: [p.id, p.place, p.address, p.time, p.inNewEvents],
          }
        : {
            text: `INSERT INTO collection_places (place, address, usual_time, in_new_events)
                   VALUES ($1, $2, $3, $4)`,
            params: [p.place, p.address, p.time, p.inNewEvents],
          },
    ),
  ])
  return listCollectionPlaces()
}
