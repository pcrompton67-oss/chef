import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import type { EditableCourse } from '@/lib/event-editing'

/**
 * Reads a photo of Eleanor's printed menu card with Claude and turns it into
 * the start of a new evening (issue #23). Server only: it uses
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
  uncertain: z
    .array(z.string())
    .describe('Short notes, in plain English, on anything hard to read or that you had to guess. Empty if everything was clear.'),
})

type MenuCard = z.infer<typeof MenuCardSchema>

const SYSTEM = `You read photos of the printed menu cards of Eleanor Jessica, a private chef in France, for her "Dine at Home" evenings: a themed four-course menu customers collect and finish at home.

Copy the menu exactly as printed, keeping her wording, spelling and accents (fix only obvious capitalisation, e.g. spaced capitals in the title). Do not invent dishes, components, prices or dates. Courses are in printed order. A course offering two or more dishes joined by "or" is a "choice" course with one entry per dish; its components line (printed once, under the dishes) is the course description. "(v)" after a dish means vegetarian. Join a description that wraps onto two printed lines into one line, with components separated by " · ".

Her cards are usually printed in English. Each text also has a French field ("titleFr", "nameFr", …) for the French version of her website: write natural, appetising French as a French restaurant menu would, keeping dish names that are proper names or foreign words (e.g. "makhani", "bombay potato" may stay as they are if a French menu would keep them). If the card is printed in French, put the printed French in the French fields and a faithful English translation in the main fields.

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

export const MENU_CARD_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type MediaType = (typeof MENU_CARD_MEDIA_TYPES)[number]

export function menuCardReaderReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function readMenuCard(imageBase64: string, mediaType: MediaType): Promise<MenuCardResult> {
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Please read this menu card.' },
          ],
        },
      ],
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
      return { ok: false, status: 400, error: 'That photo couldn’t be read. Please try another (a JPEG or PNG photo of the card).' }
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
    return { ok: false, status: 422, error: 'This doesn’t look like a menu card. Please choose a photo of the printed menu.' }
  }
  return { ok: true, draft: toDraft(card) }
}

function toDraft(card: MenuCard): MenuCardDraft {
  const notes = [...card.uncertain]
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
