import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'

/**
 * "Suggest French" in Console → Emails (issue #36): Claude translates
 * Eleanor's English wording for an email into French in her own voice.
 * Server only: it uses ANTHROPIC_API_KEY (set in Vercel), like the menu-card
 * reader. Nothing is saved here; the console puts the suggestion in the French
 * boxes for her to check and save.
 */

const MODEL = 'claude-opus-5-5'
const MAX_TEXTS = 6
const MAX_LENGTH = 2000

const SYSTEM = `You translate short passages from emails written by Eleanor Jessica, a private chef (cheffe privée) in the Deux-Sèvres, France, to her customers. Her "Dine at Home" evenings are themed four-course menus that customers collect and finish at home.

Translate each English passage into natural, warm, elegant French, as Eleanor would write it herself to a customer. Keep her tone, warmth and length; don't add or remove ideas. Address the customer with "vous". Use French typography (e.g. a non-breaking space before ? ! : ; is not needed, but use « » for quotes and the right accents).

Keep these placeholders exactly as written, untranslated, in the right place in the sentence: {name}, {evening}, {date}. Keep blank lines between paragraphs. A sign-off line ("With warm wishes,") becomes a natural French sign-off ("Bien chaleureusement,"); a name stays as it is.

Return one translation per passage, in the same order.`

const ResultSchema = z.object({
  translations: z.array(z.string()).describe('The French translations, one per passage, in the same order.'),
})

export type FrenchResult = { ok: true; french: string[] } | { ok: false; status: number; error: string }

export function frenchSuggestionsReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function suggestFrench(raw: unknown): Promise<FrenchResult> {
  const texts = Array.isArray(raw) ? raw.map((t) => (typeof t === 'string' ? t.trim() : '')) : []
  if (!texts.length || texts.length > MAX_TEXTS || texts.some((t) => t.length > MAX_LENGTH)) {
    return { ok: false, status: 400, error: 'There is nothing to translate.' }
  }
  if (!frenchSuggestionsReady()) {
    return { ok: false, status: 503, error: 'French suggestions aren’t set up yet: the Claude key (ANTHROPIC_API_KEY) is missing in Vercel.' }
  }
  // Empty boxes stay empty; only the filled ones go to Claude.
  const filled = texts.map((t, i) => ({ t, i })).filter((x) => x.t)
  if (!filled.length) return { ok: true, french: texts.map(() => '') }

  const client = new Anthropic()
  let response
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If Claude declines (very unlikely here), the API retries on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(ResultSchema) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: filled.map((x, n) => `Passage ${n + 1}:\n${x.t}`).join('\n\n---\n\n'),
        },
      ],
    })
  } catch (err) {
    console.error('French suggestion failed', err)
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, status: 503, error: 'The Claude key in Vercel was not accepted. Please check ANTHROPIC_API_KEY.' }
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 503, error: 'Claude is busy. Please try again in a minute.' }
    }
    return { ok: false, status: 502, error: 'Claude isn’t answering right now. Please try again shortly.' }
  }

  console.info('Email French suggested', { model: response.model, usage: response.usage })

  const out = response.parsed_output?.translations
  if (response.stop_reason === 'refusal' || !out || out.length !== filled.length) {
    return { ok: false, status: 502, error: 'No French suggestion came back. Please try again, or write the French yourself.' }
  }
  const french = texts.map(() => '')
  filled.forEach((x, n) => (french[x.i] = out[n].trim()))
  return { ok: true, french }
}
