'use client'

import { useState } from 'react'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { EditableEvent } from '@/lib/event-editing'
import type { EventListItem } from '@/lib/manager-events'
import type { MenuCardDraft } from '@/lib/menu-card'

/*
 * Console → Events → "New evening from menu card" (issues #23, #33).
 * Eleanor gives her English card, her French card, or both, each as a photo
 * (taken or chosen; shrunk here in the browser) or a PDF (sent as it is).
 * Claude reads them on the server, and the events tab opens the result in the
 * normal editor as an unsaved draft.
 */

// Claude reads images best up to about this many pixels on the long side.
const MAX_SIDE = 1568
// What Vercel accepts in one request, as file sizes (PDFs aren't shrunk).
const MAX_PDF_BYTES = 3_000_000
const MAX_TOTAL_BYTES = 3_200_000

type Lang = 'en' | 'fr'
type Chosen = { file: File; preview: string; pdf: boolean }
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

export function MenuCardStart({
  events,
  onCancel,
  onRead,
}: {
  events?: EventListItem[]
  onCancel: () => void
  onRead: (draft: MenuCardDraft, base: EditableEvent | null) => void
}) {
  // Real evenings first (latest first), then test ones, marked as such.
  const byDate = [...(events ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const real = byDate.filter((e) => !e.isTest)
  const choices = [...real, ...byDate.filter((e) => e.isTest)]
  const [cards, setCards] = useState<Partial<Record<Lang, Chosen>>>({})
  const [baseId, setBaseId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Until Eleanor picks, suggest copying from her latest real evening (never a test one).
  const chosenBase = baseId ?? real[0]?.id ?? ''

  function choose(lang: Lang, f: File | null) {
    setError('')
    const old = cards[lang]
    if (old?.preview) URL.revokeObjectURL(old.preview)
    if (f && isPdf(f) && f.size > MAX_PDF_BYTES) {
      setError('That PDF is too large (more than 3 MB). Please save a smaller one, or use a photo of the card instead.')
      f = null
    }
    setCards((prev) => ({
      ...prev,
      [lang]: f ? { file: f, pdf: isPdf(f), preview: isPdf(f) ? '' : URL.createObjectURL(f) } : undefined,
    }))
  }

  const chosen = (['en', 'fr'] as const).filter((l) => cards[l])

  async function read() {
    if (!chosen.length) return
    setBusy(true)
    setError('')
    try {
      const prepared = await Promise.all(
        chosen.map(async (language) => {
          const c = cards[language]!
          return c.pdf
            ? { language, mediaType: 'application/pdf', data: await asBase64(c.file) }
            : { language, mediaType: 'image/jpeg', data: await shrink(c.file) }
        }),
      )
      if (prepared.reduce((n, c) => n + (c.data.length * 3) / 4, 0) > MAX_TOTAL_BYTES)
        throw new Error('Together these files are too large to send. Please use a photo instead of a PDF for one of them.')
      const res = await send('/api/manager/events/from-menu-card', 'POST', { cards: prepared })
      let base: EditableEvent | null = null
      if (chosenBase) {
        const loaded = await fetcher(`/api/manager/events/${chosenBase}`)
        base = loaded?.event ?? null
      }
      onRead(res.draft as MenuCardDraft, base)
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <button type="button" onClick={onCancel} className={buttonStyles('text')}>
          ‹ All evenings
        </button>
        <h2 className="text-3xl text-charcoal">New evening from a menu card</h2>
        <p className="text-sm leading-relaxed text-stone">
          Give a photo or PDF of your printed menu. It’s read for you and opens as a new evening for you to check.
          Nothing is saved until you press Save, and it starts as a hidden draft. The cards themselves aren’t kept.
        </p>
      </div>

      <section className="space-y-6 border border-border bg-ivory px-4 py-6 sm:px-6">
        <h3 className="caps text-gold-deep">1 · The menu card</h3>
        <p className="text-sm leading-relaxed text-stone">
          Give your English card, your French card, or both, each as a photo or a PDF. With both, each language is
          copied word for word from your own card; with one, the other language is written for you to check.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {(
            [
              ['en', 'English card'],
              ['fr', 'French card'],
            ] as const
          ).map(([lang, label]) => {
            const c = cards[lang]
            return (
              <div key={lang} className="space-y-3">
                <label className="block space-y-2">
                  <span className="block text-sm text-charcoal">{label}</span>
                  <input
                    // A new box after "Remove", so it no longer shows the old file name.
                    key={c ? 'chosen' : 'empty'}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    disabled={busy}
                    onChange={(e) => choose(lang, e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-charcoal file:mr-4 file:rounded-none file:border file:border-charcoal file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-charcoal"
                  />
                </label>
                {c?.pdf ? (
                  <p className="border border-border px-3 py-2 text-sm text-charcoal">PDF · {c.file.name}</p>
                ) : c ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.preview} alt={`The chosen ${label.toLowerCase()}`} className="max-h-72 border border-border object-contain" />
                ) : null}
                {c ? (
                  <button type="button" disabled={busy} onClick={() => choose(lang, null)} className={buttonStyles('text')}>
                    Remove
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="text-xs leading-relaxed text-stone">
          On your phone you can take a photo: lay the card flat, in good light, with the whole card in the picture. A PDF
          can be up to 3 MB.
        </p>
      </section>

      <section className="space-y-6 border border-border bg-ivory px-4 py-6 sm:px-6">
        <h3 className="caps text-gold-deep">2 · Copy the rest from</h3>
        <label className="block space-y-1.5">
          <span className="block text-sm text-charcoal">Previous evening (optional)</span>
          <select
            className="w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none focus:border-gold"
            value={chosenBase}
            disabled={busy}
            onChange={(e) => setBaseId(e.target.value)}
          >
            <option value="">Nothing: start empty</option>
            {choices.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.date}
                {e.isTest ? ' (test)' : ''}
              </option>
            ))}
          </select>
          <span className="block text-xs leading-relaxed text-stone">
            The deposit, number of diners, main photo and collection points aren’t on the card, so they can be copied
            from an earlier evening. The price is copied too if the card doesn’t show one.
          </span>
        </label>
      </section>

      <div className="space-y-4">
        <button type="button" disabled={!chosen.length || busy} onClick={read} className={buttonStyles('solid')}>
          {busy ? 'Reading the menu…' : chosen.length > 1 ? 'Read both cards' : 'Read the menu'}
        </button>
        {busy ? (
          <p className="text-sm text-stone">
            This usually takes 10 to 30 seconds{chosen.length > 1 ? ', a little longer for two cards' : ''}. Please keep
            this page open.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** A PDF as base64 text to send, unchanged. */
async function asBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

/** Shrinks the photo and turns it into JPEG text to send (smaller, faster and cheaper to read). */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => {
      throw new Error('That file couldn’t be opened as a photo. Please choose a JPEG or PNG photo, or a PDF.')
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser couldn’t prepare the photo. Please try another browser.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  } finally {
    URL.revokeObjectURL(url)
  }
}
