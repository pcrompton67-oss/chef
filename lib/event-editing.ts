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
  menuImage: string
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
