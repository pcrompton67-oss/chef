'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { ChevronDown, Search, Trash2, UserPlus } from 'lucide-react'
import type { Customer, CustomerOrder, ReminderSend } from './lib'
import { EmailCard, EmailEditor, SendButton } from './email-card'
import { describeSendResult, type SendResult } from '@/lib/send-result'
import {
  deliveryDateFor,
  formatPrice,
  formatSaleDate,
  orderItemLabel,
} from '@/lib/types'
import {
  REMINDER_PLACEHOLDERS,
  buildReminderText,
  fillTemplate,
  type ReminderInput,
} from './reminder-email'

// The manager console passes in its PIN-aware fetch helpers so this file has
// no dependency on how a given site does auth.
export type CustomerApi = {
  fetcher: (url: string) => Promise<unknown>
  send: (url: string, method: string, body?: unknown) => Promise<unknown>
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30'

/* ------------------------------ Customers tab --------------------------- */

type SortMode = 'name' | 'newest'
const SORT_KEY = 'customers-sort'

// Name order puts people without a name (website sign-ups) at the end,
// sorted by email; newest first goes by when they were added.
function sortCustomers(list: Customer[], mode: SortMode): Customer[] {
  const copy = [...list]
  if (mode === 'newest') {
    return copy.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }
  return copy.sort((a, b) => {
    const an = a.name.trim()
    const bn = b.name.trim()
    if (!an !== !bn) return an ? -1 : 1
    return (an || a.email).localeCompare(bn || b.email, 'fr', { sensitivity: 'base' })
  })
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

export function CustomersTab({ api }: { api: CustomerApi }) {
  const [query, setQuery] = useState('')
  const key = `/api/customers?q=${encodeURIComponent(query)}`
  const { data, isLoading } = useSWR<{ customers: Customer[] }>(
    key,
    api.fetcher as (url: string) => Promise<{ customers: Customer[] }>,
    { keepPreviousData: true },
  )
  const customers = data?.customers ?? []
  const subscribed = customers.filter((c) => c.subscribed && c.consented_at)

  // Sort order, remembered on this device. Read after the first render so
  // the page never disagrees with itself while loading.
  const [sort, setSort] = useState<SortMode>('name')
  useEffect(() => {
    try {
      if (localStorage.getItem(SORT_KEY) === 'newest') setSort('newest')
    } catch {}
  }, [])
  function chooseSort(next: SortMode) {
    setSort(next)
    try {
      localStorage.setItem(SORT_KEY, next)
    } catch {}
  }
  const sorted = useMemo(() => sortCustomers(customers, sort), [customers, sort])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function refresh() {
    await mutate(
      (k) => typeof k === 'string' && k.startsWith('/api/customers'),
      undefined,
      { revalidate: true },
    )
  }

  async function add() {
    if (!name.trim() || !email.trim()) return
    setBusy(true)
    setMsg('')
    try {
      await api.send('/api/customers', 'POST', { name, email })
      setName('')
      setEmail('')
      await refresh()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-brand-dark">
          Customers
        </h2>
        <span className="text-sm text-brand-dark/60">
          {customers.length} on file · {subscribed.length} get reminders
        </span>
      </div>

      <p className="text-sm leading-relaxed text-brand-dark/70">
        Everyone who has ordered is listed here. Only people who ticked the
        reminder box, signed up on the website, or that you add by hand
        receive &ldquo;orders open&rdquo; emails. Deleting someone removes their name and email from
        this list but keeps their past orders.
      </p>

      {/* Add by hand */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/60">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Jane Dupont"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/60">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
              }}
              className={inputClass}
              placeholder="jane@example.com"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={busy || !name.trim() || !email.trim()}
            className="flex items-center justify-center gap-2 rounded-md bg-brand-green px-4 py-3 font-bold text-brand-cream transition-colors hover:bg-brand-green-dark disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-brand-dark/50">
          Only add people who have asked to be told when orders open.
        </p>
        {msg ? <p className="mt-2 text-sm text-destructive">{msg}</p> : null}
      </div>

      {/* Search and sort */}
      <div className="flex flex-wrap items-center gap-3">
      <label className="relative block min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search customers"
          className={`${inputClass} pl-11`}
        />
      </label>
      <div
        role="group"
        aria-label="Sort customers"
        className="flex shrink-0 overflow-hidden rounded-md border border-border bg-card text-sm"
      >
        {(
          [
            ['name', 'Name'],
            ['newest', 'Newest first'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={sort === value}
            onClick={() => chooseSort(value)}
            className={`px-3 py-2 font-semibold transition-colors ${
              sort === value
                ? 'bg-brand-green text-brand-cream'
                : 'text-brand-dark/70 hover:bg-brand-dark/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* List */}
      {isLoading && customers.length === 0 ? (
        <p className="text-sm text-brand-dark/60">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card p-6 text-center text-brand-dark/60">
          {query ? 'No one matches that search.' : 'No customers yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((c) => (
            <CustomerRow key={c.id} customer={c} api={api} onChange={refresh} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CustomerRow({
  customer: c,
  api,
  onChange,
}: {
  customer: Customer
  api: CustomerApi
  onChange: () => Promise<void>
}) {
  const [name, setName] = useState(c.name)
  const [email, setEmail] = useState(c.email)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  // Website sign-ups may have no name; use their email wherever a name is shown.
  const label = c.name.trim() || c.email

  async function save(patch: {
    name?: string
    email?: string
    subscribed?: boolean
  }) {
    setError('')
    try {
      await api.send('/api/customers', 'PATCH', { id: c.id, ...patch })
      await onChange()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove() {
    if (!confirm(`Remove ${label} from the customer list?`)) return
    try {
      await api.send(`/api/customers?id=${c.id}`, 'DELETE')
      await onChange()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const receives = c.subscribed && c.consented_at

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== c.name && save({ name })}
          aria-label={`Name for ${c.email}`}
          placeholder="No name, tap to add"
          className="min-w-40 flex-1 bg-transparent font-semibold text-brand-dark outline-none placeholder:font-normal placeholder:italic placeholder:text-brand-dark/40"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email.trim() !== c.email && save({ email })}
          aria-label={`Email for ${label}`}
          className="min-w-52 flex-1 bg-transparent text-sm text-brand-dark/80 outline-none"
        />
        {c.order_count > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-1 rounded-full bg-brand-green/10 px-3 py-1 text-sm font-semibold text-brand-green transition-colors hover:bg-brand-green/20"
          >
            {plural(c.order_count, 'order')}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="px-3 py-1 text-sm text-brand-dark/40">No orders</span>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={Boolean(receives)}
            onChange={(e) => save({ subscribed: e.target.checked })}
            className="h-4 w-4 accent-brand-green"
          />
          Reminders
        </label>
        <button
          type="button"
          onClick={remove}
          aria-label={`Delete ${label}`}
          className="rounded-md p-2 text-brand-dark/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-brand-dark/50">
        <span>
          {c.source === 'manual'
            ? 'Added by hand'
            : c.source === 'signup'
              ? 'Signed up on the website'
              : 'From an order'}
          {c.created_at ? ` · Added ${formatDay(c.created_at)}` : ''}
        </span>
        {c.last_order_at ? (
          <span>
            Last order{' '}
            {formatDay(c.last_order_at)}
          </span>
        ) : null}
        {!c.consented_at ? <span>Did not tick the reminder box</span> : null}
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      {open ? <OrderHistory customerId={c.id} api={api} /> : null}
    </li>
  )
}

/* ----------------------------- Order history ---------------------------- */

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  email: 'Email',
  messenger: 'Messenger',
  phone: 'Phone',
  in_person: 'In person',
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

const thisYear = () =>
  new Date().toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Europe/Paris' })

// "8 Nov", with the year added when it isn't this year.
function shortDay(iso: string): string {
  const d = new Date(iso)
  const year = d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Europe/Paris' })
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(year === thisYear() ? {} : { year: 'numeric' }),
    timeZone: 'Europe/Paris',
  })
}

// "September", or "September 2025" when it isn't this year.
function monthOf(iso: string): string {
  const d = new Date(iso)
  const year = d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Europe/Paris' })
  return d.toLocaleDateString('en-GB', {
    month: 'long',
    ...(year === thisYear() ? {} : { year: 'numeric' }),
    timeZone: 'Europe/Paris',
  })
}

// The day this order was dropped off, e.g. "Friday 6 November", falling back
// to the delivery's name when the run had no dates.
function deliveryLabel(o: CustomerOrder): string {
  const date = deliveryDateFor(o, o.delivery_day) ?? o.sale_date
  if (date) {
    const year = String(date).slice(0, 4)
    return formatSaleDate(date) + (year === thisYear() ? '' : ` ${year}`)
  }
  return o.menu_name || 'Delivery with no date'
}

function OrderHistory({ customerId, api }: { customerId: number; api: CustomerApi }) {
  const { data, error } = useSWR<{ orders: CustomerOrder[] }>(
    `/api/customers/orders?id=${customerId}`,
    api.fetcher as (url: string) => Promise<{ orders: CustomerOrder[] }>,
  )

  if (!data && !error) {
    return <p className="mt-3 text-sm text-brand-dark/60">Loading orders…</p>
  }
  // The console's fetcher hands back the error body rather than throwing.
  if (error || !Array.isArray(data?.orders)) {
    return <p className="mt-3 text-sm text-destructive">Could not load orders.</p>
  }
  const orders = data.orders
  if (orders.length === 0) {
    return <p className="mt-3 text-sm text-brand-dark/60">No orders found.</p>
  }
  const byName = orders.filter((o) => o.matched_by === 'name').length

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-sm font-semibold text-brand-dark">
        {plural(orders.length, 'order')} since {monthOf(orders[orders.length - 1].created_at)}
        {' · '}last ordered {shortDay(orders[0].created_at)}
      </p>
      {byName > 0 ? (
        <p className="mt-0.5 text-xs text-brand-dark/60">
          {byName === orders.length ? 'All' : byName} matched by name only (no email on the
          order), so check {byName === 1 ? 'it is' : 'they are'} really this customer.
        </p>
      ) : null}
      <ul className="mt-2 flex flex-col gap-2">
        {orders.map((o) => (
          <li key={o.id} className="rounded-md bg-muted/50 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-brand-dark">{deliveryLabel(o)}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-brand-dark/60">
                  <span>{o.village_name ?? 'No drop-off town'}</span>
                  <span>· Ordered {shortDay(o.created_at)}</span>
                  <span className="rounded-sm bg-brand-yellow/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                    {SOURCE_LABELS[o.source] ?? o.source}
                  </span>
                  {o.matched_by === 'name' ? (
                    <span className="rounded-sm border border-brand-dark/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark/70">
                      Matched by name
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 font-bold tabular-nums text-brand-dark">
                {formatPrice(o.items.reduce((sum, it) => sum + it.price_cents * it.quantity, 0))}
              </span>
            </div>
            <ul className="mt-1 text-sm tabular-nums text-brand-dark/80">
              {o.items.map((it) => (
                <li key={it.id}>
                  {it.quantity} × {orderItemLabel(it)}
                </li>
              ))}
            </ul>
            {o.notes ? (
              <p className="mt-1 text-xs text-brand-dark/60">Note: {o.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------------------- Reminder panel ---------------------------- */

type RemindPreview = {
  ready: boolean
  reason?: string
  recipientCount: number
  emailConfigured: boolean
  subjectTemplate?: string
  bodyTemplate?: string
  input?: ReminderInput
  sampleRecipient?: { name: string; unsubscribe_token: string }
  subject?: string
  recipients?: { name: string; email: string }[]
  alreadySent?: number
  remaining?: number
  history: ReminderSend[]
}

export function SendReminderPanel({ api }: { api: CustomerApi }) {
  const { data, mutate: refetch } = useSWR<RemindPreview>(
    '/api/customers/remind',
    api.fetcher as (url: string) => Promise<RemindPreview>,
  )
  // null = "not edited yet, use the server default"; keeps the defaults in
  // sync if the delivery changes before the manager touches the text.
  const [subjectDraft, setSubjectDraft] = useState<string | null>(null)
  const [bodyDraft, setBodyDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const subject = subjectDraft ?? data?.subjectTemplate ?? ''
  const body = bodyDraft ?? data?.bodyTemplate ?? ''
  const edited = subjectDraft !== null || bodyDraft !== null
  const missingName = !/\{\{\s*first_name\s*\}\}/.test(body)
  const literalNames = (data?.recipients ?? [])
    .map((r) => r.name.trim().split(/\s+/)[0])
    .filter((n) => n && n.length > 2)
  const greetingLine = body.split('\n').find((l) => l.trim()) ?? ''
  const pastedName = literalNames.find((n) =>
    new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
      greetingLine,
    ),
  )

  // Fall back to placeholder values so the preview always renders something,
  // even if the cached response predates the template fields.
  const previewInput: ReminderInput = data?.input ?? {
    deliveryLabel: '(delivery dates)',
    orderCloseLabel: '(order deadline)',
    siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
  }
  const previewRecipient = data?.sampleRecipient ?? {
    name: 'Sarah Example',
    unsubscribe_token: 'example',
  }
  const preview = data
    ? {
        subject: fillTemplate(subject, previewInput, previewRecipient),
        body: buildReminderText(body, previewInput, previewRecipient),
      }
    : null

  const alreadySent = data?.alreadySent ?? 0
  const remaining = data?.remaining ?? data?.recipientCount ?? 0

  async function sendAll(everyone = false) {
    if (!data || !preview) return
    const count = everyone ? data.recipientCount : remaining
    const warning = pastedName
      ? `\n\nWARNING: the greeting says "${pastedName}". Every customer would get that name. Use {{first_name}} instead.`
      : missingName
        ? '\n\nNote: the email has no {{first_name}}, so it will not greet customers by name.'
        : ''
    const again = everyone && alreadySent > 0
      ? `\n\n${alreadySent} of them have already had it for this delivery and will get it again.`
      : ''
    const ok = confirm(
      `Email ${count} customer${count === 1 ? '' : 's'} now?\n\nSubject: ${preview.subject}${again}${warning}`,
    )
    if (!ok) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const r = (await api.send('/api/customers/remind', 'POST', {
        subject,
        body,
        everyone,
      })) as SendResult
      setResult(describeSendResult(r))
      await refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copyAddresses() {
    const list = (data?.recipients ?? []).map((r) => r.email).join(', ')
    try {
      await navigator.clipboard.writeText(list)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the addresses in the preview instead.')
    }
  }

  if (!data) return null

  const lastSend = data.history[0]
  const status =
    (!data.ready
      ? data.reason
      : alreadySent === 0
        ? `${data.recipientCount} customer${data.recipientCount === 1 ? '' : 's'} will get this email.`
        : remaining > 0
          ? `${alreadySent} of ${data.recipientCount} customers have had it for this delivery. ${remaining} still to send.`
          : `All ${data.recipientCount} customers have had it for this delivery.`) +
    (lastSend
      ? ` Last sent ${new Date(lastSend.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${lastSend.sent_count}.`
      : '')

  const actions = !data.ready ? null : data.emailConfigured ? (
    <SendButton
      busy={busy}
      disabled={remaining === 0}
      onClick={() => sendAll(false)}
      label={alreadySent > 0 ? `Send to the ${remaining} remaining` : `Send to all ${remaining}`}
    />
  ) : (
    <SendButton
      busy={false}
      disabled={!data.recipientCount}
      onClick={copyAddresses}
      label={copied ? 'Copied!' : 'Copy all email addresses'}
    />
  )

  return (
    <EmailCard
      title="Tell customers orders are open"
      status={status}
      open={showPreview}
      onToggle={() => {
        if (!showPreview) void refetch()
        setShowPreview((s) => !s)
      }}
      canOpen={data.ready}
      actions={actions}
      result={result}
      error={error}
    >
      {!data.emailConfigured ? (
        <p className="mb-3 text-xs leading-relaxed text-brand-dark/60">
          Sending from the site is off until an email provider is connected (add{' '}
          <code>RESEND_API_KEY</code> in Vars). Until then, copy the addresses into your own
          email&apos;s BCC field.
        </p>
      ) : null}
      {data.emailConfigured && alreadySent > 0 && !busy ? (
        <button
          type="button"
          onClick={() => sendAll(true)}
          className="mb-3 text-xs font-semibold text-brand-dark/60 underline underline-offset-2"
        >
          Send again to everyone ({data.recipientCount}), including the {alreadySent} who already had it
        </button>
      ) : null}
      <EmailEditor
        subject={subject}
        body={body}
        onSubject={setSubjectDraft}
        onBody={setBodyDraft}
        placeholders={REMINDER_PLACEHOLDERS}
        preview={preview}
        edited={edited}
        onReset={() => {
          setSubjectDraft(null)
          setBodyDraft(null)
        }}
        warning={
          pastedName
            ? `The greeting says "${pastedName}" — every customer would get that name. Replace it with {{first_name}}.`
            : missingName
              ? 'There is no {{first_name}} in the email, so customers will not be greeted by name.'
              : undefined
        }
      />
    </EmailCard>
  )
}
