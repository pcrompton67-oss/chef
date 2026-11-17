import type { Locale } from '@/lib/i18n'

/**
 * Links in mailing-list emails (issue #10): unsubscribing (at the bottom of
 * emails to people on the list) and confirming a sign-up. Kept apart from
 * lib/customers.ts so the email previews in the console (which run in the
 * browser) can use them.
 */
export function unsubscribePath(token: string, locale: Locale): string {
  return `${locale === 'fr' ? '/fr' : ''}/unsubscribe?t=${token}`
}

/** The link in the sign-up confirmation email. */
export function confirmSignupPath(token: string, locale: Locale): string {
  return `${locale === 'fr' ? '/fr' : ''}/confirm-subscription?t=${token}`
}
