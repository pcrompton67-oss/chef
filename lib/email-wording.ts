import { content } from '@/lib/content'
import type { Locale } from '@/lib/i18n'

/**
 * Eleanor's own wording for the customer emails (issue #36): the opening and
 * closing paragraphs of each email, and the sign-off, in English and French.
 * Edited in Console → Emails and stored in `settings` under 'email_wording'.
 * An empty text means "use the original wording from lib/content.ts", so
 * nothing is ever sent blank. The facts (order, amounts, bank details,
 * address, links) are never part of this and can't be edited.
 *
 * No database here: the console uses it in the browser for previews.
 */

export const WORDING_KINDS = ['received', 'confirmed', 'reminder', 'signup'] as const
export type WordingKind = (typeof WORDING_KINDS)[number]
export type WordingPart = 'opening' | 'closing'

export type Texts = { en: string; fr: string }
export type EmailWording = {
  emails: Record<WordingKind, Record<WordingPart, Texts>>
  signOff: Texts
  signature: Texts
}

/** Placeholders Eleanor can type; filled in for each customer. */
export const PLACEHOLDERS: { key: string; label: string; orderOnly: boolean }[] = [
  { key: '{name}', label: 'the customer’s name', orderOnly: true },
  { key: '{evening}', label: 'the evening’s title', orderOnly: true },
  { key: '{date}', label: 'the date of the evening', orderOnly: true },
]

/** Longest text kept for one box. */
const MAX = 2000

const blank = (): Texts => ({ en: '', fr: '' })

export function emptyWording(): EmailWording {
  const emails = {} as EmailWording['emails']
  for (const k of WORDING_KINDS) emails[k] = { opening: blank(), closing: blank() }
  return { emails, signOff: blank(), signature: blank() }
}

/** Today's built-in wording, written with placeholders: what each box shows until Eleanor changes it. */
export function defaultText(kind: WordingKind | 'signOff' | 'signature', part: WordingPart | null, loc: Locale): string {
  const c = content[loc].email
  if (kind === 'signOff') return c.signOff
  if (kind === 'signature') return c.signature
  if (part === 'opening') {
    if (kind === 'received') return c.received.intro('{evening}', '{date}')
    if (kind === 'confirmed') return c.confirmed.intro('{evening}', '{date}')
    if (kind === 'reminder') return c.reminder.intro('{evening}', '{date}')
    return c.signup.intro
  }
  return kind === 'reminder' ? c.reminder.outro : ''
}

/** Tidies what the console sent: only known boxes, trimmed, not too long, and "same as the original" stored as empty. */
export function normalizeWording(raw: unknown): EmailWording {
  const w = emptyWording()
  const src = (raw ?? {}) as Partial<EmailWording>
  const clean = (v: unknown, kind: WordingKind | 'signOff' | 'signature', part: WordingPart | null, loc: Locale) => {
    const s = typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, MAX) : ''
    return s === defaultText(kind, part, loc).trim() ? '' : s
  }
  for (const k of WORDING_KINDS) {
    for (const part of ['opening', 'closing'] as const) {
      const t = src.emails?.[k]?.[part]
      w.emails[k][part] = { en: clean(t?.en, k, part, 'en'), fr: clean(t?.fr, k, part, 'fr') }
    }
  }
  for (const k of ['signOff', 'signature'] as const) {
    w[k] = { en: clean(src[k]?.en, k, null, 'en'), fr: clean(src[k]?.fr, k, null, 'fr') }
  }
  return w
}

/** Eleanor's text for one box in one language, or null to use the original. */
export function customText(w: EmailWording | undefined, kind: WordingKind, part: WordingPart, loc: Locale): string | null {
  const s = w?.emails[kind]?.[part]?.[loc]?.trim()
  return s ? s : null
}

/** Fills in {name}, {evening} and {date}; anything else in braces is left as typed. */
export function fillPlaceholders(text: string, vars: { name?: string; evening?: string; date?: string }): string {
  return text.replace(/\{(name|evening|date)\}/gi, (m, key: string) => {
    const v = vars[key.toLowerCase() as keyof typeof vars]
    return v === undefined ? m : v
  })
}

/** Splits a box into paragraphs at blank lines. */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}
