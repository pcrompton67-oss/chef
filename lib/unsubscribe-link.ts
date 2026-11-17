import type { Locale } from '@/lib/i18n'

/**
 * The unsubscribe link at the bottom of emails to people on the mailing list
 * (issue #10). Kept apart from lib/customers.ts so the email previews in the
 * console (which run in the browser) can use it.
 */
export function unsubscribePath(token: string, locale: Locale): string {
  return `${locale === 'fr' ? '/fr' : ''}/unsubscribe?t=${token}`
}
