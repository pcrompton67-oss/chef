'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { getStoredPin } from '@/components/pin-gate'
import {
  HOME_UPCOMING_DELIVERIES,
  MAX_UPCOMING_DELIVERIES,
  formatUpcoming,
  type UpcomingDelivery,
} from '@/lib/upcoming-shared'

const LIST_URL = '/api/upcoming-deliveries'

function pinHeaders(): Record<string, string> {
  return { 'x-pin': getStoredPin('manager') }
}

const fetcher = (url: string) =>
  fetch(url, { headers: pinHeaders() }).then((r) => r.json())

type Draft = { start_date: string; end_date: string; note: string }

const EMPTY: Draft = { start_date: '', end_date: '', note: '' }

function nextDay(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function save(url: string, method: 'POST' | 'PATCH', draft: Draft): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...pinHeaders() },
    body: JSON.stringify(draft),
  })
  if (res.ok) return null
  const body = await res.json().catch(() => ({}))
  return body.error || 'Could not save the date'
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-green'

function DateFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  idPrefix: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-brand-dark/70" htmlFor={`${idPrefix}-start`}>
        First day
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={draft.start_date}
          onChange={(e) => {
            const start = e.target.value
            // Most runs are Friday + Saturday, so suggest the following day.
            const end = !draft.end_date || draft.end_date < start ? nextDay(start) : draft.end_date
            onChange({ ...draft, start_date: start, end_date: end })
          }}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-brand-dark/70" htmlFor={`${idPrefix}-end`}>
        Second day (optional)
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={draft.end_date}
          min={draft.start_date || undefined}
          onChange={(e) => onChange({ ...draft, end_date: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-brand-dark/70" htmlFor={`${idPrefix}-note`}>
        Note (optional)
        <input
          id={`${idPrefix}-note`}
          type="text"
          maxLength={120}
          placeholder="e.g. Christmas delivery"
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          className={inputClass}
        />
      </label>
    </div>
  )
}

function Row({
  delivery,
  position,
  onSaved,
}: {
  delivery: UpcomingDelivery
  position: number
  onSaved: () => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({
    start_date: delivery.start_date,
    end_date: delivery.end_date ?? '',
    note: delivery.note,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onHome = position <= HOME_UPCOMING_DELIVERIES

  async function handleSave() {
    setBusy(true)
    const err = await save(`${LIST_URL}/${delivery.id}`, 'PATCH', draft)
    setBusy(false)
    setError(err)
    if (!err) {
      setEditing(false)
      await onSaved()
    }
  }

  async function handleDelete() {
    if (!window.confirm('Remove this date?')) return
    setBusy(true)
    await fetch(`${LIST_URL}/${delivery.id}`, { method: 'DELETE', headers: pinHeaders() })
    setBusy(false)
    await onSaved()
  }

  return (
    <li className="flex flex-col gap-3 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-brand-cream">
            {position}
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-brand-dark">
              {formatUpcoming(delivery.start_date, delivery.end_date)}
            </span>
            <span className="text-xs text-brand-dark/60">
              {delivery.note ? `${delivery.note} · ` : ''}
              {onHome ? 'Shown on home page' : 'Not shown yet (waiting its turn)'}
            </span>
          </div>
        </div>
        {!editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-brand-dark hover:bg-muted"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-muted disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <DateFields draft={draft} onChange={setDraft} idPrefix={`upcoming-${delivery.id}`} />
          {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold text-brand-cream hover:bg-brand-green-dark disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function UpcomingDeliveriesPanel() {
  const { data, mutate } = useSWR<{ deliveries: UpcomingDelivery[] }>(LIST_URL, fetcher)
  const deliveries = data?.deliveries ?? []
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const full = deliveries.length >= MAX_UPCOMING_DELIVERIES

  async function handleAdd() {
    setBusy(true)
    const err = await save(LIST_URL, 'POST', draft)
    setBusy(false)
    setError(err)
    if (!err) {
      setDraft(EMPTY)
      await mutate()
    }
  }

  return (
    <section className="mt-5 flex flex-col gap-4 rounded-md border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-brand-green">Next deliveries</h2>
        <p className="text-sm leading-relaxed text-brand-dark/70">
          Plan up to {MAX_UPCOMING_DELIVERIES} dates ahead. The home page shows the next{' '}
          {HOME_UPCOMING_DELIVERIES}. Once a date has passed it drops off by itself, the
          others move up, and a free slot opens here.
        </p>
      </div>

      {data && deliveries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-brand-dark/60">
          No dates planned yet.
        </p>
      ) : (
        <ol className="flex flex-col">
          {deliveries.map((d, i) => (
            <Row
              key={`${d.id}-${d.start_date}-${d.end_date}-${d.note}`}
              delivery={d}
              position={i + 1}
              onSaved={mutate}
            />
          ))}
        </ol>
      )}

      {full ? (
        <p className="text-sm text-brand-dark/60">
          All {MAX_UPCOMING_DELIVERIES} slots are filled. A slot opens once the next delivery has passed.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-4">
          <p className="text-sm font-bold text-brand-dark">
            Add a date ({deliveries.length} of {MAX_UPCOMING_DELIVERIES} used)
          </p>
          <DateFields draft={draft} onChange={setDraft} idPrefix="upcoming-new" />
          {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !draft.start_date}
            className="self-start rounded-md bg-brand-green px-4 py-2 text-sm font-bold text-brand-cream hover:bg-brand-green-dark disabled:opacity-60"
          >
            Add date
          </button>
        </div>
      )}
    </section>
  )
}
