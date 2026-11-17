export type Locale = 'en' | 'fr'

export function dateLocale(locale: Locale = 'en'): string {
  return locale === 'fr' ? 'fr-FR' : 'en-GB'
}

// "&" / "to" between the two days of a run.
export function rangeJoiners(locale: Locale = 'en') {
  return locale === 'fr' ? { and: 'et', to: 'au' } : { and: '&', to: 'to' }
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

const CATEGORY_NAMES_FR: Record<string, string> = {
  'Sausage Rolls': 'Sausage roll (friand à la saucisse)',
  Sausages: 'Saucisses',
  'Gluten Free Sausages': 'Saucisses sans gluten',
  'Breakfast Patties': 'Galettes de saucisse (petit-déjeuner)',
  Christmas: 'Noël',
}

export function categoryName(category: string, locale: Locale): string {
  return locale === 'fr' ? CATEGORY_NAMES_FR[category] ?? category : category
}
