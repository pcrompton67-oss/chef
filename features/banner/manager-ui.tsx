'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { getStoredPin } from '@/components/pin-gate'
import { AnnouncementBanner } from '@/components/announcement-banner'
import {
  BANNER_MESSAGE_MAX,
  BANNER_TITLE_MAX,
  EMPTY_BANNER,
  type SiteBanner,
} from '@/lib/banner-shared'

const URL = '/api/banner'

function pinHeaders(): Record<string, string> {
  return { 'x-pin': getStoredPin('manager') }
}

const fetcher = (url: string) =>
  fetch(url, { headers: pinHeaders() }).then((r) => r.json())

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-green'

const labelClass =
  'flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-brand-dark/70'

function BannerForm({ initial, onSaved }: { initial: SiteBanner; onSaved: () => Promise<unknown> }) {
  const [draft, setDraft] = useState<SiteBanner>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(next: SiteBanner) {
    setBusy(true)
    setSaved(false)
    const res = await fetch(URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...pinHeaders() },
      body: JSON.stringify({ ...next, ends_on: next.ends_on ?? '' }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(body.error || 'Could not save the banner')
      return
    }
    setError(null)
    setSaved(true)
    setDraft(body.banner)
    await onSaved()
  }

  const hasText = draft.title.trim() !== '' || draft.message.trim() !== ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-brand-dark">
            {initial.is_active ? 'Banner is showing on the home page' : 'Banner is switched off'}
          </span>
          <span className="text-xs text-brand-dark/60">
            Changes appear on the home page as soon as you save.
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-dark">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            className="h-5 w-5 accent-brand-green"
          />
          Show on home page
        </label>
      </div>

      <label className={labelClass} htmlFor="banner-title">
        Heading
        <input
          id="banner-title"
          type="text"
          maxLength={BANNER_TITLE_MAX}
          placeholder="e.g. Christmas specials are here"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className={labelClass} htmlFor="banner-message">
        Message
        <textarea
          id="banner-message"
          rows={3}
          maxLength={BANNER_MESSAGE_MAX}
          placeholder="e.g. Pigs in blankets and cranberry sausage rolls available all December."
          value={draft.message}
          onChange={(e) => setDraft({ ...draft, message: e.target.value })}
          className={`${inputClass} resize-y normal-case tracking-normal`}
        />
        <span className="self-end font-normal normal-case tracking-normal text-brand-dark/50">
          {draft.message.length}/{BANNER_MESSAGE_MAX}
        </span>
      </label>

      <label className={`${labelClass} sm:max-w-xs`} htmlFor="banner-ends">
        Hide automatically after (optional)
        <input
          id="banner-ends"
          type="date"
          value={draft.ends_on ?? ''}
          onChange={(e) => setDraft({ ...draft, ends_on: e.target.value || null })}
          className={inputClass}
        />
      </label>

      {hasText ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-dark/70">Preview</span>
          <div className="overflow-hidden rounded-md border border-border">
            <AnnouncementBanner banner={draft} />
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
      {saved && !error ? (
        <p role="status" className="text-sm font-semibold text-brand-green">Saved.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit(draft)}
          disabled={busy}
          className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold text-brand-cream hover:bg-brand-green-dark disabled:opacity-60"
        >
          Save banner
        </button>
        {hasText ? (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Clear the banner text and switch it off?')) return
              submit(EMPTY_BANNER)
            }}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-destructive hover:bg-muted disabled:opacity-60"
          >
            Clear banner
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function BannerPanel() {
  const { data, mutate } = useSWR<{ banner: SiteBanner }>(URL, fetcher)

  return (
    <section className="mt-5 flex flex-col gap-4 rounded-md border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-brand-green">Home page banner</h2>
        <p className="text-sm leading-relaxed text-brand-dark/70">
          Announce seasonal flavours, Christmas products or anything else. It sits at the very top of
          the home page.
        </p>
      </div>
      {data?.banner ? (
        <BannerForm
          key={`${data.banner.is_active}-${data.banner.title}-${data.banner.message}-${data.banner.ends_on}`}
          initial={data.banner}
          onSaved={mutate}
        />
      ) : (
        <p className="text-sm text-brand-dark/60">Loading…</p>
      )}
    </section>
  )
}
