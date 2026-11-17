export const MAX_UPCOMING_DELIVERIES = 5
export const HOME_UPCOMING_DELIVERIES = 3

export type UpcomingDelivery = {
  id: number
  start_date: string
  end_date: string | null
  note: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function parts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
  return {
    time: d.getTime(),
    weekday: fmt({ weekday: 'long' }),
    day: fmt({ day: 'numeric' }),
    month: fmt({ month: 'long' }),
  }
}

export function parseDeliveryInput(
  body: unknown,
): { start_date: string; end_date: string | null; note: string } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (!isIsoDate(b.start_date)) return { error: 'Please choose a first delivery day' }
  const end = b.end_date === '' || b.end_date == null ? null : b.end_date
  if (end !== null && !isIsoDate(end)) return { error: 'The second day is not a valid date' }
  if (end !== null && end < b.start_date) {
    return { error: 'The second day must be on or after the first' }
  }
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 120) : ''
  return { start_date: b.start_date, end_date: end === b.start_date ? null : end, note }
}

const ONE_DAY = 24 * 60 * 60 * 1000

/** "Friday 6 & Saturday 7 November", "Friday 31 October & Saturday 1 November", "Friday 6 November". */
export function formatUpcoming(start: string, end: string | null): string {
  const s = parts(start)
  if (!end || end === start) return `${s.weekday} ${s.day} ${s.month}`
  const e = parts(end)
  const joiner = e.time - s.time === ONE_DAY ? '&' : 'to'
  const first =
    s.month === e.month ? `${s.weekday} ${s.day}` : `${s.weekday} ${s.day} ${s.month}`
  return `${first} ${joiner} ${e.weekday} ${e.day} ${e.month}`
}
