export type SiteBanner = {
  is_active: boolean
  title: string
  message: string
  ends_on: string | null
}

export const EMPTY_BANNER: SiteBanner = {
  is_active: false,
  title: '',
  message: '',
  ends_on: null,
}

export const BANNER_TITLE_MAX = 60
export const BANNER_MESSAGE_MAX = 240

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseBannerInput(body: unknown): SiteBanner | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  const message = typeof b.message === 'string' ? b.message.trim() : ''
  const endsRaw = typeof b.ends_on === 'string' ? b.ends_on.trim() : ''
  const is_active = b.is_active === true

  if (title.length > BANNER_TITLE_MAX) {
    return { error: `Keep the heading under ${BANNER_TITLE_MAX} characters` }
  }
  if (message.length > BANNER_MESSAGE_MAX) {
    return { error: `Keep the message under ${BANNER_MESSAGE_MAX} characters` }
  }
  if (is_active && !title && !message) {
    return { error: 'Add a heading or a message before turning the banner on' }
  }
  if (endsRaw && !ISO_DATE.test(endsRaw)) {
    return { error: 'That end date is not valid' }
  }
  return { is_active, title, message, ends_on: endsRaw || null }
}

export function formatBannerEnd(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  })
}
