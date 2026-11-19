/**
 * Shapes and lists shared by the console's event editor (in the browser) and
 * lib/manager-events.ts (on the server). No database code here.
 */

export const STATUSES = ['draft', 'open', 'sold_out', 'closed', 'done'] as const
export type ManagerStatus = (typeof STATUSES)[number]

/** Eleanor's own uploaded photos (Vercel Blob, issue #20; server side in lib/photos.ts). */
export const PHOTO_FOLDER = 'event-photos/'
export type UploadedPhoto = { url: string; uploadedAt: string }

/** True for the web address of a photo uploaded from the console. */
export function isUploadedPhoto(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/event-photos\/[\w.-]+$/i.test(url)
}

/**
 * Printed menus (issue #37): a PDF or a photo per language, kept in Vercel
 * Blob under printed-menus/ (server side in lib/printed-menus.ts). Not listed
 * with the photos; an evening stores the address in menu_image / menu_image_fr.
 */
export const MENU_FOLDER = 'printed-menus/'

/** True for the web address of a printed menu uploaded from the console. */
export function isUploadedMenu(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/printed-menus\/[\w.-]+$/i.test(url)
}

/** True when a printed menu is a PDF (shown as a link rather than a picture). */
export function isPdf(url: string): boolean {
  return /\.pdf$/i.test(url)
}

/** Photos that came with the site (files in public/). */
export const IMAGES = [
  { path: '/CEJ_Banner.jpg', label: 'Banner' },
  { path: '/CEF_Food1.jpg', label: 'Food photo 1' },
  { path: '/CEJ_Food2.jpg', label: 'Food photo 2' },
  { path: '/CEJ_Menu_Indian.jpg', label: 'Printed menu – Indian' },
  { path: '/CEJ_Logo.jpg', label: 'Logo' },
] as const

export type EditableOption = {
  id: string | null // null = new, not yet saved
  name: string
  nameFr: string // French wording ('' = use the English)
  vegetarian: boolean
  description: string
}

export type EditableCourse = {
  id: string | null
  name: string
  nameFr: string
  kind: 'fixed' | 'choice'
  description: string
  descriptionFr: string
  options: EditableOption[]
}

export type EditablePoint = {
  id: string | null
  place: string
  time: string // HH:MM, Paris
  address: string
}

/** A place on the master list of collection places (issue #35). */
export type CollectionPlace = {
  id: string | null
  place: string
  address: string
  time: string // usual collection time, HH:MM Paris
  /** Put into every new evening automatically. */
  inNewEvents: boolean
}

export type EditableEvent = {
  id: string | null
  slug: string
  title: string
  theme: string
  date: string // YYYY-MM-DD
  intro: string
  /** French wording for the French site (issue #12); empty = use the English. */
  titleFr: string
  themeFr: string
  introFr: string
  heroImage: string
  /** The photo further down the evening's page (issue #37); empty = the usual one. */
  secondImage: string
  /** Printed menu (photo or PDF) for the English site, and for the French site (issue #37). */
  menuImage: string
  menuImageFr: string
  priceCents: number
  depositCents: number
  capacity: number
  cutoffAt: string // YYYY-MM-DDTHH:MM, Paris time
  status: ManagerStatus
  isTest: boolean
  courses: EditableCourse[]
  collectionPoints: EditablePoint[]
}

/** Extra facts shown alongside an event in the console (not edited). */
export type EventFacts = {
  placesTaken: number
  orderCount: number
  /** Dishes and collection points that orders use: they can't be removed. */
  usedOptionIds: string[]
  usedPointIds: string[]
}

/* ---------- When orders close (Console → Settings, issue #43) ---------- */

/** How a new evening's last orders are set: so many days before, at a time (Paris). */
export type CutoffRule = { cutoffDaysBefore: number; cutoffTime: string }
export const DEFAULT_CUTOFF: CutoffRule = { cutoffDaysBefore: 2, cutoffTime: '23:59' }
export const MAX_CUTOFF_DAYS = 14

/** True for a number of days from 0 to MAX_CUTOFF_DAYS and a time like 18:00. */
export function cutoffRuleOk(r: CutoffRule) {
  return (
    Number.isInteger(r.cutoffDaysBefore) &&
    r.cutoffDaysBefore >= 0 &&
    r.cutoffDaysBefore <= MAX_CUTOFF_DAYS &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(r.cutoffTime)
  )
}

/** Last orders for an evening on `date` (YYYY-MM-DD): YYYY-MM-DDTHH:MM, Paris time. */
export function cutoffFor(date: string, rule: CutoffRule = DEFAULT_CUTOFF) {
  const r = cutoffRuleOk(rule) ? rule : DEFAULT_CUTOFF
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - r.cutoffDaysBefore)
  return d.toISOString().slice(0, 10) + 'T' + r.cutoffTime
}

/** "2 days before, at 23:59" / "the same day, at 15:00", for notes and hints. */
export function describeCutoff(r: CutoffRule) {
  const when =
    r.cutoffDaysBefore === 0
      ? 'on the day of the evening'
      : `${r.cutoffDaysBefore} day${r.cutoffDaysBefore === 1 ? '' : 's'} before the evening`
  return `${when}, at ${r.cutoffTime}`
}
