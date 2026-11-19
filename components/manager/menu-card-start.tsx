'use client'

import { useState } from 'react'
import { send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { EventListItem } from '@/lib/manager-events'
import type { MenuCardDraft } from '@/lib/menu-card'
import { ImagePicker } from '@/components/manager/image-picker'
import { MAX_CUTOFF_DAYS, cutoffRuleOk, describeCutoff, type CutoffRule } from '@/lib/event-editing'

/*
 * Console → Events → "New evening from menu card" (issues #23, #33).
 * Eleanor gives her English card, her French card, or both, each as a photo
 * (taken or chosen; shrunk here in the browser) or a PDF (sent as it is).
 * Claude reads them on the server, and the events tab opens the result in the
 * normal editor as an unsaved draft. Optionally she also picks the main and
 * second photo here (issue #39). The number of diners is set here too
 * (issue #41), and when orders close, starting from Settings (issue #43); the
 * deposit is half the price per person. Nothing is copied from an earlier
 * evening (issue #42).
 */

/** Photos chosen on this page; empty = the usual photo. */
export type CardPhotos = { heroImage: string; secondImage: string }

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
  cutoffRule,
  onCancel,
  onRead,
}: {
  events?: EventListItem[]
  /** From Console → Settings; Eleanor can change it here for this evening. */
  cutoffRule: CutoffRule
  onCancel: () => void
  onRead: (draft: MenuCardDraft, photos: CardPhotos, capacity: number, cutoff: CutoffRule) => void
}) {
  // Her latest real evening (never a test one), for the usual number of diners.
  const latest = [...(events ?? [])].filter((e) => !e.isTest).sort((a, b) => b.date.localeCompare(a.date))[0]
  const [cards, setCards] = useState<Partial<Record<Lang, Chosen>>>({})
  // The number of diners Eleanor typed; until she types one, her latest real evening's (or 40).
  const [typedCapacity, setTypedCapacity] = useState<string | null>(null)
  // Last orders as Eleanor typed them; until she types, the rule from Settings.
  const [typedDays, setTypedDays] = useState<string | null>(null)
  const [typedTime, setTypedTime] = useState<string | null>(null)
  const [photos, setPhotos] = useState<CardPhotos>({ heroImage: '', secondImage: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const capacityText = typedCapacity ?? String(latest?.capacity ?? 40)
  const capacity = Number(capacityText)
  const capacityOk = /^\d+$/.test(capacityText.trim()) && capacity >= 1
  const daysText = typedDays ?? String(cutoffRule.cutoffDaysBefore)
  const cutoff: CutoffRule = { cutoffDaysBefore: Number(daysText), cutoffTime: typedTime ?? cutoffRule.cutoffTime }
  const cutoffOk = /^\d+$/.test(daysText.trim()) && cutoffRuleOk(cutoff)

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
      onRead(res.draft as MenuCardDraft, photos, capacity, cutoff)
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
          Nothing is saved until you press Save, and it starts as a hidden draft. The cards are kept as the evening’s printed menus.
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
        <h3 className="caps text-gold-deep">2 · Diners and last orders</h3>
        <label className="block space-y-1.5">
          <span className="block text-sm text-charcoal">Diners (capacity)</span>
          <input
            inputMode="numeric"
            className="w-32 rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none focus:border-gold"
            value={capacityText}
            disabled={busy}
            onChange={(e) => setTypedCapacity(e.target.value)}
          />
          <span className={capacityOk ? 'block text-xs leading-relaxed text-stone' : 'block text-xs leading-relaxed text-destructive'}>
            {capacityOk
              ? 'How many diners the evening can take in all. The deposit is set to half the price per person.'
              : 'Please enter a whole number of diners (at least 1).'}
          </span>
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm text-charcoal">Last orders</span>
          <div className="flex flex-wrap items-center gap-3 text-sm text-charcoal">
            <input
              inputMode="numeric"
              aria-label="Days before the evening"
              className="w-20 rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none focus:border-gold"
              value={daysText}
              disabled={busy}
              onChange={(e) => setTypedDays(e.target.value)}
            />
            <span>days before, at</span>
            <input
              type="time"
              aria-label="Time"
              className="w-32 rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none focus:border-gold"
              value={cutoff.cutoffTime}
              disabled={busy}
              onChange={(e) => setTypedTime(e.target.value)}
            />
          </div>
          <span className={cutoffOk ? 'block text-xs leading-relaxed text-stone' : 'block text-xs leading-relaxed text-destructive'}>
            {cutoffOk
              ? `Orders close ${describeCutoff(cutoff)} (French time). 0 days means the day itself. The usual setting is in Settings.`
              : `Please enter a number of days from 0 to ${MAX_CUTOFF_DAYS} and a time.`}
          </span>
        </div>
      </section>

      <section className="space-y-6 border border-border bg-ivory px-4 py-6 sm:px-6">
        <h3 className="caps text-gold-deep">3 · Photos (optional)</h3>
        <p className="text-sm leading-relaxed text-stone">
          Upload or choose the evening’s photos now, or leave them and do it later in the evening itself.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImagePicker
            label="Main photo (hero)"
            hint="At the top of the evening’s page, and on its card on the home page. Empty: the usual photo."
            noneLabel="Not chosen"
            value={photos.heroImage}
            onChange={(v) => setPhotos((p) => ({ ...p, heroImage: v }))}
          />
          <ImagePicker
            label="Second photo"
            hint="Further down the evening’s page, beside the price and collection times. Empty: the usual photo."
            noneLabel="Not chosen"
            value={photos.secondImage}
            onChange={(v) => setPhotos((p) => ({ ...p, secondImage: v }))}
          />
        </div>
      </section>

      <div className="space-y-4">
        <button type="button" disabled={!chosen.length || !capacityOk || !cutoffOk || busy} onClick={read} className={buttonStyles('solid')}>
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
