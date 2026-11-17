'use client'

import { useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, pinHeaders, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { CustomerRow } from '@/lib/customers'
import { cn } from '@/lib/utils'

/*
 * Console → Customers (issue #10): everyone who has ordered or signed up, their
 * orders, and whether they're on the mailing list ("new box dates and other
 * news"). The spreadsheet download holds only real people on the list.
 */

type Filter = 'all' | 'list' | 'off' | 'signup'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'list', label: 'On the mailing list' },
  { id: 'off', label: 'Not on the list' },
  { id: 'signup', label: 'Used a sign-up box' },
]

const matches = (c: CustomerRow, f: Filter) =>
  f === 'all' || (f === 'list' ? c.onList : f === 'off' ? !c.onList : c.signups.length > 0)

export function CustomersTab() {
  const { data, mutate } = useSWR<{ customers?: CustomerRow[] }>('/api/manager/customers', fetcher)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const all = data?.customers
  if (!all) return <p className="text-sm text-stone">Loading…</p>

  const q = search.trim().toLowerCase()
  const shown = all.filter(
    (c) => matches(c, filter) && (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)),
  )
  const onList = all.filter((c) => c.onList && !c.isTest).length

  async function download() {
    setDownloading(true)
    setError('')
    try {
      const res = await fetch('/api/manager/customers?format=csv', { headers: pinHeaders() })
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `mailing-list-${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not download the list. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-ivory px-5 py-4">
        <p className="text-sm text-charcoal">
          <span className="font-display text-2xl">{onList}</span>{' '}
          {onList === 1 ? 'person is' : 'people are'} on the mailing list
          {all.some((c) => c.isTest) ? <span className="text-stone"> (test customers not counted)</span> : null}
        </p>
        <button type="button" className={buttonStyles('solid')} onClick={download} disabled={downloading}>
          {downloading ? 'Preparing…' : 'Download list (CSV)'}
        </button>
      </div>
      <p className="-mt-4 text-sm text-stone">
        The list only holds people who ticked “new box dates and other news” when ordering, or used a sign-up box
        (home page or sold-out evening) and then confirmed by email, and haven’t unsubscribed. Sign-ups still
        waiting for confirmation don’t appear here. Test customers are never included.
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-4">
        <input
          type="search"
          placeholder="Search by name or email"
          aria-label="Search by name or email"
          className={inputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'border px-3 py-1.5 text-sm transition-colors',
                filter === f.id ? 'border-charcoal bg-charcoal text-ivory' : 'border-stone/40 text-charcoal hover:border-gold',
              )}
            >
              {f.label} ({all.filter((c) => matches(c, f.id)).length})
            </button>
          ))}
        </div>
      </div>

      <CustomerList customers={shown} onChanged={() => mutate()} />
    </div>
  )
}

function CustomerList({ customers, onChanged }: { customers: CustomerRow[]; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!customers.length) return <p className="text-sm text-stone">No customers here.</p>
  return (
    <ul className="divide-y divide-border border-y border-border">
      {customers.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            aria-expanded={open === c.id}
            onClick={() => setOpen(open === c.id ? null : c.id)}
            className="block w-full px-1 py-4 text-left transition-colors hover:bg-ivory"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-display text-xl text-charcoal">
                {c.name || c.email}
                {c.isTest ? <span className="caps ml-2 text-[0.6rem] text-stone">Test</span> : null}
              </span>
              <span className={cn('caps text-[0.6rem]', c.onList ? 'text-gold-deep' : 'text-stone')}>
                {c.onList ? 'On the list' : c.unsubscribedAt ? 'Unsubscribed' : 'Not on the list'}
              </span>
            </span>
            <span className="mt-1 block text-sm text-stone">
              {[c.name ? c.email : null, ordersLabel(c), c.signups.length ? 'Used a sign-up box' : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
          {open === c.id ? <CustomerDetail customer={c} onChanged={onChanged} /> : null}
        </li>
      ))}
    </ul>
  )
}

function CustomerDetail({ customer: c, onChanged }: { customer: CustomerRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function unsubscribe() {
    if (!window.confirm(`Take ${c.name || c.email} off the mailing list? Only they can join again, by ticking the box or signing up.`)) return
    setBusy(true)
    setError('')
    try {
      await send('/api/manager/customers', 'POST', { id: c.id, action: 'unsubscribe' })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unsubscribe.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 px-1 pb-6">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <Item label="Email">{c.email}</Item>
        {c.mobile ? <Item label="Mobile">{c.mobile}</Item> : null}
        <Item label="Language">{c.language === 'fr' ? 'French' : 'English'}</Item>
        <Item label="Came from">{SOURCE[c.source] ?? '—'}</Item>
        <Item label="First seen">{formatDate(c.createdAt)}</Item>
        <Item label="Mailing list">
          {c.onList
            ? `Yes, since ${formatDateTime(c.consentAt)}`
            : c.unsubscribedAt
              ? `No, unsubscribed ${formatDateTime(c.unsubscribedAt)}`
              : 'No (didn’t tick the box)'}
        </Item>
      </dl>

      {c.signups.length ? (
        <div className="space-y-2">
          <h3 className="caps text-xs text-charcoal">Sign-ups</h3>
          <ul className="space-y-1 text-sm text-charcoal">
            {c.signups.map((s, i) => (
              <li key={i}>
                {s.event ? `Sold-out evening box · ${s.event}` : 'Home page box'} · {formatDateTime(s.date)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="caps text-xs text-charcoal">Orders</h3>
        {c.orders.length ? (
          <ul className="space-y-1 text-sm text-charcoal">
            {c.orders.map((o) => (
              <li key={o.id}>
                {formatDate(o.date)} · {o.event} · {o.diners} diner{o.diners === 1 ? '' : 's'} ·{' '}
                {money(o.totalCents)} · <span className="text-stone">{ORDER_STATUS[o.status] ?? o.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone">No orders yet.</p>
        )}
      </div>

      {c.onList ? (
        <button type="button" className={buttonStyles('outline')} onClick={unsubscribe} disabled={busy}>
          Take off the mailing list
        </button>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

/* ---------- Helpers ---------- */

const SOURCE: Record<string, string> = {
  website: 'Website order',
  console: 'Order you added',
  signup: 'Sign-up box',
}

const ORDER_STATUS: Record<string, string> = {
  held: 'Waiting for deposit',
  awaiting_transfer: 'Waiting for deposit',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

function ordersLabel(c: CustomerRow) {
  return c.orders.length ? `${c.orders.length} order${c.orders.length === 1 ? '' : 's'}` : null
}

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-stone">{label}</dt>
      <dd className="text-charcoal">{children}</dd>
    </>
  )
}

function money(cents: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function formatDate(d: string) {
  return new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

function formatDateTime(d: string) {
  if (!d) return '—'
  return `${formatDate(d)}, ${d.slice(11, 16)}`
}
