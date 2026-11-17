'use client'

import { useState } from 'react'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { EditableEvent } from '@/lib/event-editing'
import type { EventListItem } from '@/lib/manager-events'
import type { MenuCardDraft } from '@/lib/menu-card'

/*
 * Console → Events → "New evening from menu card" (issue #23).
 * Eleanor takes or chooses a photo of her printed menu; it's shrunk here in
 * the browser, read by Claude on the server, and handed back to the events
 * tab, which opens it in the normal editor as an unsaved draft.
 */

// Claude reads images best up to about this many pixels on the long side.
const MAX_SIDE = 1568

export function MenuCardStart({
  events,
  onCancel,
  onRead,
}: {
  events?: EventListItem[]
  onCancel: () => void
  onRead: (draft: MenuCardDraft, base: EditableEvent | null) => void
}) {
  const real = (events ?? []).filter((e) => !e.isTest).sort((a, b) => b.date.localeCompare(a.date))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [baseId, setBaseId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Until Eleanor picks, suggest copying from her latest real evening.
  const chosenBase = baseId ?? real[0]?.id ?? ''

  function choose(f: File | null) {
    setError('')
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : '')
  }

  async function read() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const image = await shrink(file)
      const res = await send('/api/manager/events/from-menu-card', 'POST', { image, mediaType: 'image/jpeg' })
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
          Take or choose a photo of your printed menu. It’s read for you and opens as a new evening for you to check.
          Nothing is saved until you press Save, and it starts as a hidden draft. The photo itself isn’t kept.
        </p>
      </div>

      <section className="space-y-6 border border-border bg-ivory px-4 py-6 sm:px-6">
        <h3 className="caps text-gold-deep">1 · The menu card</h3>
        <label className="block space-y-2">
          <span className="block text-sm text-charcoal">Photo of the card</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-charcoal file:mr-4 file:rounded-none file:border file:border-charcoal file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-charcoal"
          />
          <span className="block text-xs leading-relaxed text-stone">
            On your phone this lets you take a photo. Lay the card flat, in good light, with the whole card in the picture.
          </span>
        </label>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="The chosen menu card" className="max-h-80 border border-border object-contain" />
        ) : null}
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
            {real.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.date}
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
        <button type="button" disabled={!file || busy} onClick={read} className={buttonStyles('solid')}>
          {busy ? 'Reading the menu…' : 'Read the menu'}
        </button>
        {busy ? (
          <p className="text-sm text-stone">This usually takes 10 to 30 seconds. Please keep this page open.</p>
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

/** Shrinks the photo and turns it into JPEG text to send (smaller, faster and cheaper to read). */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => {
      throw new Error('That file couldn’t be opened as a photo. Please choose a JPEG or PNG photo.')
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
