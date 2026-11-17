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
