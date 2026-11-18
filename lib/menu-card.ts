import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import type { EditableCourse } from '@/lib/event-editing'

/**
 * Reads Eleanor's printed menu card with Claude and turns it into the start of
 * a new evening (issue #23). A card can be a photo or a PDF, and she can give
 * an English card, a French card, or both (issue #33): with both, each
 * language is taken word for word from her own card; with one, Claude writes
 * the other language and the draft's notes say so. Server only: it uses
 * ANTHROPIC_API_KEY (set in Vercel). Nothing is saved here; the console opens
 * the result in the normal event editor as an unsaved draft.
 */

const MODEL = 'claude-opus-5-5'

/** What Claude returns for one card (checked against this shape). */
const MenuCardSchema = z.object({
  isMenuCard: z.boolean().describe('False if the photo is not a menu at all.'),
  title: z.string().describe('The evening’s theme in English, in normal capitalisation, e.g. "Inspired by India". Empty if none.'),
  titleFr: z.string().describe('The same title in French, e.g. "Inspiré par l’Inde". Empty if no title.'),
  date: z
    .object({
      day: z.number().int(),
      month: z.number().int().describe('1 to 12'),
      year: z.number().int().nullable().describe('Only if a year is printed.'),
    })
    .nullable()
    .describe('The date printed on the card, if any.'),
  pricePerPersonEuros: z.number().nullable().describe('Price per person if printed, e.g. 40.'),
  intro: z
    .string()
    .describe('Any general lines printed under the price or menu (e.g. what is included), joined into one short paragraph, in English. Empty if none.'),
  introFr: z.string().describe('The same paragraph in French. Empty if none.'),
  courses: z.array(
    z.object({
      name: z.string().describe('Starter, Second course, Main, Dessert… (usually not printed: name it from its position).'),
      nameFr: z.string().describe('The course name in French: Entrée, Deuxième plat, Plat, Dessert…'),
      kind: z.enum(['fixed', 'choice']).describe('"choice" when two or more dishes are offered with "or".'),
      description: z
        .string()
        .describe('The smaller line of components under the dish(es), exactly as printed, components separated by " · ". Empty if none.'),
      descriptionFr: z.string().describe('The same components line in French, components separated by " · ". Empty if none.'),
      dishes: z.array(
        z.object({
          name: z.string().describe('The dish name as printed, without the (v) mark.'),
          nameFr: z.string().describe('The dish name in French, without the (v) mark.'),
          vegetarian: z.boolean().describe('True if marked (v).'),
        }),
      ),
    }),
  ),
  translated: z
    .object({
      english: z.boolean().describe('True if you wrote any of the English wording yourself (it was not printed on a card).'),
      french: z.boolean().describe('True if you wrote any of the French wording yourself (it was not printed on a card).'),
    })
    .describe('Which language you had to translate rather than copy.'),
  uncertain: z
    .array(z.string())
    .describe(
      'Short notes, in plain English, on anything hard to read, that you had to guess, or that differs between the English and French cards. Empty if everything was clear.',
    ),
})

type MenuCard = z.infer<typeof MenuCardSchema>

const SYSTEM = `You read the printed menu cards (photos or PDFs) of Eleanor Jessica, a private chef in France, for her "Dine at Home" evenings: a themed four-course menu customers collect and finish at home.

Copy the menu exactly as printed, keeping her wording, spelling and accents (fix only obvious capitalisation, e.g. spaced capitals in the title). Do not invent dishes, components, prices or dates. Courses are in printed order. A course offering two or more dishes joined by "or" is a "choice" course with one entry per dish; its components line (printed once, under the dishes) is the course description. "(v)" after a dish means vegetarian. Join a description that wraps onto two printed lines into one line, with components separated by " · ".

Every text has an English field ("title", "name", …) and a French field ("titleFr", "nameFr", …), for the two languages of her website. You are given her English card, her French card, or both; each is labelled.
- With both cards: they are the same menu. Copy the English fields word for word from the English card and the French fields word for word from the French card; translate nothing. Match them course by course and dish by dish. If they differ (a dish or course on only one card, a different price or date, a different (v) mark), follow the English card for the menu itself and say exactly what differs in "uncertain".
- With one card: copy its language exactly, and write the other language yourself. French: natural, appetising French as a French restaurant menu would, keeping dish names that are proper names or foreign words (e.g. "makhani", "bombay potato" may stay as they are if a French menu would keep them). English: a faithful translation. Set "translated" for the language you wrote. A card in the other box's language (e.g. a French card given as the English one) is fine: treat it as what it really is.
- A PDF with several pages: read the menu on it. If it holds more than one different menu, use the first and say so in "uncertain".

Ignore the logo, "Dine at Home" heading and decorative lines. If anything is unreadable or you had to guess, say so in "uncertain" rather than guessing silently.`

/** What the console receives: the parts of an evening the card can fill. */
export type MenuCardDraft = {
  title: string
  intro: string
  titleFr: string
  introFr: string
  date: string // YYYY-MM-DD, or '' if not on the card
  priceCents: number | null
  courses: EditableCourse[]
  notes: string[]
}

export type MenuCardResult = { ok: true; draft: MenuCardDraft } | { ok: false; error: string; status: number }

export const MENU_CARD_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
type MediaType = (typeof MENU_CARD_MEDIA_TYPES)[number]

/** One card as sent by the console: which language box it was given in, and the file. */
export type MenuCardFile = { language: 'en' | 'fr'; data: string; mediaType: MediaType }

export function menuCardReaderReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function readMenuCard(cards: MenuCardFile[]): Promise<MenuCardResult> {
  if (!menuCardReaderReady()) {
    return {
      ok: false,
      status: 503,
      error: 'The menu reader isn’t set up yet: the Claude key (ANTHROPIC_API_KEY) is missing in Vercel.',
    }
  }

  const client = new Anthropic()
  let response
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If Claude declines (very unlikely for a menu), the API retries on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(MenuCardSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: cardContent(cards) }],
    })
  } catch (err) {
    console.error('Menu card reader failed', err)
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, status: 503, error: 'The Claude key in Vercel was not accepted. Please check ANTHROPIC_API_KEY.' }
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 503, error: 'The menu reader is busy. Please try again in a minute.' }
    }
    if (err instanceof Anthropic.BadRequestError) {
      return {
        ok: false,
        status: 400,
        error: 'That file couldn’t be read. Please try another (a photo or a PDF of the card, not password-protected).',
      }
    }
    return { ok: false, status: 502, error: 'The menu reader isn’t answering right now. Please try again shortly.' }
  }

  console.info('Menu card read', { model: response.model, usage: response.usage })

  if (response.stop_reason === 'refusal') {
    return { ok: false, status: 422, error: 'The menu reader declined this photo. Please try another photo, or fill the evening in by hand.' }
  }
  const card = response.parsed_output
  if (!card || response.stop_reason === 'max_tokens') {
    return { ok: false, status: 502, error: 'The menu couldn’t be read completely. Please try again.' }
  }
  if (!card.isMenuCard || card.courses.length === 0) {
    return {
      ok: false,
      status: 422,
      error: 'This doesn’t look like a menu card. Please choose a photo or PDF of the printed menu.',
    }
  }
  return { ok: true, draft: toDraft(card) }
}

/** The cards as Claude sees them: each one labelled with the box it was given in. */
function cardContent(cards: MenuCardFile[]): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  for (const c of cards) {
    content.push({ type: 'text', text: c.language === 'fr' ? 'Her French card:' : 'Her English card:' })
    content.push(
      c.mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.data } }
        : { type: 'image', source: { type: 'base64', media_type: c.mediaType, data: c.data } },
    )
  }
  content.push({
    type: 'text',
    text: cards.length > 1 ? 'Please read these two menu cards: the same menu in English and in French.' : 'Please read this menu card.',
  })
  return content
}

function toDraft(card: MenuCard): MenuCardDraft {
  const notes = [...card.uncertain]
  if (card.translated.english) notes.push('The English wording was written by Claude from the French card: please read it through.')
  if (card.translated.french) notes.push('The French wording was written by Claude: please read it through before opening the evening.')
  const date = cardDate(card.date)
  if (card.date && !date) notes.push('The date on the card didn’t make sense, so it was left empty.')
  const price = card.pricePerPersonEuros
  return {
    title: card.title.trim(),
    intro: card.intro.trim(),
    titleFr: card.titleFr.trim(),
    introFr: card.introFr.trim(),
    date,
    priceCents: price !== null && price > 0 && price < 1000 ? Math.round(price * 100) : null,
    courses: card.courses.map((c) => ({
      id: null,
      name: c.name.trim(),
      nameFr: c.nameFr.trim(),
      kind: c.kind === 'choice' && c.dishes.length >= 2 ? 'choice' : 'fixed',
      description: c.description.trim(),
      descriptionFr: c.descriptionFr.trim(),
      options: c.dishes.map((d) => ({
        id: null,
        name: d.name.replace(/\s*\(v\)\s*$/i, '').trim(),
        nameFr: d.nameFr.replace(/\s*\(v\)\s*$/i, '').trim(),
        vegetarian: d.vegetarian,
        description: '',
      })),
    })),
    notes,
  }
}

/** The card's date as YYYY-MM-DD. Without a printed year: the next time that day comes round (Paris time). */
function cardDate(d: MenuCard['date']): string {
  if (!d) return ''
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const pad = (n: number) => String(n).padStart(2, '0')
  const make = (y: number) => {
    const s = `${y}-${pad(d.month)}-${pad(d.day)}`
    const check = new Date(`${s}T12:00:00Z`)
    return check.getUTCMonth() + 1 === d.month && check.getUTCDate() === d.day ? s : ''
  }
  if (d.year) return make(d.year)
  const year = Number(today.slice(0, 4))
  const thisYear = make(year)
  if (!thisYear) return ''
  return thisYear >= today ? thisYear : make(year + 1)
}
