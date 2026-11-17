/**
 * Shapes and lists shared by the console's event editor (in the browser) and
 * lib/manager-events.ts (on the server). No database code here.
 */

export const STATUSES = ['draft', 'open', 'sold_out', 'closed', 'done'] as const
export type ManagerStatus = (typeof STATUSES)[number]

/** Photos Eleanor can choose from (files in public/). Uploads: issue #20. */
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
  vegetarian: boolean
  description: string
}

export type EditableCourse = {
  id: string | null
  name: string
  kind: 'fixed' | 'choice'
  description: string
  options: EditableOption[]
}

export type EditablePoint = {
  id: string | null
  place: string
  time: string // HH:MM, Paris
  address: string
}

export type EditableEvent = {
  id: string | null
  slug: string
  title: string
  theme: string
  date: string // YYYY-MM-DD
  intro: string
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
