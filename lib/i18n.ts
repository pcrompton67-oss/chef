export type Locale = 'en' | 'fr'

export function dateLocale(locale: Locale = 'en'): string {
  return locale === 'fr' ? 'fr-FR' : 'en-GB'
}

/** Prefixes a public path with /fr for the French site. */
export function localePath(path: string, locale: Locale): string {
  if (locale === 'en') return path
  return path === '/' ? '/fr' : `/fr${path}`
}

const DAY_NAMES_FR: Record<string, string> = {
  Monday: 'Lundi',
  Tuesday: 'Mardi',
  Wednesday: 'Mercredi',
  Thursday: 'Jeudi',
  Friday: 'Vendredi',
  Saturday: 'Samedi',
  Sunday: 'Dimanche',
}

export function dayName(day: string, locale: Locale): string {
  return locale === 'fr' ? DAY_NAMES_FR[day] ?? day : day
}

/** A YYYY-MM-DD date as "Friday 4 December 2026" / "Vendredi 4 décembre 2026". */
export function formatDate(date: string, locale: Locale, withYear = true): string {
  const text = new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A timestamp as a Paris date, e.g. "Wednesday 2 December". */
export function formatParisDay(iso: string, locale: Locale): string {
  const day = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  return formatDate(day, locale, false)
}

/** "17:00" stays "17:00" in English and becomes "17h00" in French. */
export function formatTime(time: string, locale: Locale): string {
  return locale === 'fr' ? time.replace(':', 'h') : time
}

/** Euro cents as "€40" / "40 €" (pennies only shown when there are some). */
export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(dateLocale(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}
