/**
 * The site's public address. Used for share previews and for links and the
 * logo in emails. Change it here if the domain changes (see issue #24).
 * www is the main address; the bare domain and the old chefej.popol.tech
 * redirect to it (set in Vercel → Domains).
 */
export const SITE_URL = 'https://www.ejdineathome.com'

/** Emails are sent from Eleanor's domain through Resend (issue #13). */
export const EMAIL_FROM = 'Eleanor Jessica <eleanor@ejdineathome.com>'
/** Where customers' replies go (Resend can only send, not receive). */
export const EMAIL_REPLY_TO = 'Eleanor <privatechefeleanor@gmail.com>'
/** Where Eleanor's copy of each new order is sent. */
export const OWNER_EMAIL = 'privatechefeleanor@gmail.com'

/**
 * Eleanor's business details for the legal pages (issue #11), taken from
 * her own site, chefeleanor.com: mentions
 * légales, privacy policy and booking terms. The one place to fill them in.
 * Anything left as `null` shows on the site as a highlighted
 * "[to be supplied: …]" placeholder (its description is in lib/content.ts,
 * `legal.missing`), so gaps are easy to spot before go-live.
 */
export const BUSINESS = {
  /** Her full legal name, as registered. */
  legalName: 'Eleanor Jessica Girling',
  /** The name the business trades under. */
  tradingName: 'Eleanor Jessica, cheffe privée',
  legalForm: 'Entrepreneur individuel (EI)',
  /** Business address, on one line. */
  address: '1 Impasse des Jardins, 79190 Lorigné',
  siret: '932 428 600 00013',
  /** Code APE (her activity code). */
  activityCode: '56.21Z',
  /** Her VAT status, or a VAT number if she registers for VAT. */
  vat: 'TVA non applicable, art. 293 B du CGI',
  phone: '+33 6 71 68 61 64',
  email: OWNER_EMAIL,
  /** Professional liability insurer (the area covered, the EU, is in the wording). */
  insurance: 'MAIF',
  /** The consumer mediator she has signed up with: name and website. */
  mediator: null,
} satisfies Record<string, string | null>

export type BusinessField = keyof typeof BUSINESS

/** Who hosts the website (required in the mentions légales). */
export const WEB_HOST = 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States · vercel.com'

/** Where each legal page lives (the same in English and, under /fr, in French). */
export const LEGAL_PATHS = {
  legalNotice: '/legal-notice',
  privacy: '/privacy',
  allergens: '/allergens',
  terms: '/booking-terms',
} as const
