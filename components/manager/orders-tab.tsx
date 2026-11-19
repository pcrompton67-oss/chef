'use client'

import { transferReference } from '@/lib/email-templates'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { EditableEvent, EventFacts } from '@/lib/event-editing'
import type { EventListItem } from '@/lib/manager-events'
import {
  METHOD_LABEL,
  SOURCE_LABEL,
  canChangeOrder,
  repriceOrder,
  type ConsoleOrder,
  type OrderAction,
} from '@/lib/order-editing'
import { cn } from '@/lib/utils'

/* Console → Orders: one evening's orders, their payments, and orders Eleanor takes herself. */

type Filter = 'active' | 'waiting' | 'paid' | 'collected' | 'cancelled'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: 'All current' },
  { id: 'waiting', label: 'Waiting for deposit' },
  { id: 'paid', label: 'Deposit paid' },
  { id: 'collected', label: 'Collected' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function OrdersTab() {
  const events = useSWR<{ events?: EventListItem[] }>('/api/manager/events', fetcher)
  const [eventId, setEventId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // The order being changed (issue #21); shown in place of the list, like "Add an order".
  const [editing, setEditing] = useState<ConsoleOrder | null>(null)
  const [filter, setFilter] = useState<Filter>('active')

  // Start on the next evening to come (or the latest one if none are coming).
  useEffect(() => {
    const list = events.data?.events
    if (eventId || !list?.length) return
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
    const upcoming = list.filter((e) => e.date >= today && e.status !== 'draft')
    setEventId((upcoming[upcoming.length - 1] ?? list[0]).id)
  }, [events.data, eventId])

  const detail = useSWR<{ event?: EditableEvent; facts?: EventFacts }>(
    eventId ? `/api/manager/events/${eventId}` : null,
    fetcher,
  )
  const orders = useSWR<{ orders?: ConsoleOrder[] }>(
    eventId ? `/api/manager/orders?event=${eventId}` : null,
    fetcher,
  )
  const refresh = () => {
    orders.mutate()
    detail.mutate()
    events.mutate()
  }

  const list = events.data?.events
  if (!list) return <p className="text-sm text-stone">Loading…</p>
  if (!list.length) return <p className="text-sm text-stone">No evenings yet. Create one in Events first.</p>

  const event = detail.data?.event
  const all = orders.data?.orders

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block min-w-0 flex-1 space-y-1.5">
          <span className="block text-sm text-charcoal">Evening</span>
          <select
            className={inputClass}
            value={eventId ?? ''}
            onChange={(e) => {
              setEventId(e.target.value)
              setAdding(false)
              setEditing(null)
            }}
          >
            {list.map((e) => (
              <option key={e.id} value={e.id}>
                {formatDate(e.date)} · {e.title}
                {e.status === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
        </label>
        {!adding && !editing ? (
          <button type="button" className={buttonStyles('solid')} onClick={() => setAdding(true)} disabled={!event}>
            Add an order
          </button>
        ) : null}
      </div>

      {!event || !all ? (
        <p className="text-sm text-stone">Loading…</p>
      ) : adding || editing ? (
        <AddOrder
          key={editing?.id ?? 'new'}
          event={event}
          order={editing}
          placesLeft={event.capacity - takenBy(all)}
          onDone={(saved) => {
            setAdding(false)
            setEditing(null)
            if (saved) {
              refresh()
              if (!editing) setFilter('active')
            }
            window.scrollTo(0, 0)
          }}
        />
      ) : (
        <>
          <Summary event={event} orders={all} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'border px-3 py-1.5 text-sm transition-colors',
                  filter === f.id
                    ? 'border-charcoal bg-charcoal text-ivory'
                    : 'border-stone/40 text-charcoal hover:border-gold',
                )}
              >
                {f.label} ({all.filter((o) => matches(o, f.id)).length})
              </button>
            ))}
          </div>
          <OrderList
            event={event}
            orders={all.filter((o) => matches(o, filter))}
            onChanged={refresh}
            onEdit={(o) => {
              setEditing(o)
              window.scrollTo(0, 0)
            }}
          />
        </>
      )}
    </div>
  )
}

/* ---------- Summary ---------- */

function Summary({ event, orders }: { event: EditableEvent; orders: ConsoleOrder[] }) {
  const taken = takenBy(orders)
  const left = event.capacity - taken
  const live = orders.filter((o) => o.takesPlaces)
  const owedDeposits = live.filter((o) => !o.depositPaid && o.depositCents > 0).length
  const overdue = orders.filter((o) => o.overdue).length
  const refunds = orders.filter((o) => o.refundStatus === 'requested' || o.refundStatus === 'partial').length

  return (
    <section className="space-y-4 border border-border bg-ivory px-4 py-5 sm:px-6">
      <p className="font-display text-2xl text-charcoal">
        {taken} of {event.capacity} places taken
        <span className={cn('ml-3 font-sans text-sm', left < 0 ? 'text-destructive' : 'text-stone')}>
          {left < 0 ? `overbooked by ${-left}` : `${left} left`}
        </span>
      </p>
      {owedDeposits || refunds ? (
        <p className="text-sm text-charcoal">
          {owedDeposits ? `${owedDeposits} waiting for a deposit` : ''}
          {overdue ? <span className="text-destructive"> ({overdue} overdue)</span> : ''}
          {owedDeposits && refunds ? ' · ' : ''}
          {refunds ? <span className="text-destructive">{refunds} refund{refunds === 1 ? '' : 's'} to send</span> : ''}
        </p>
      ) : null}
      {event.courses
        .filter((c) => c.kind === 'choice')
        .map((c) => (
          <div key={c.id} className="text-sm text-stone">
            <span className="caps mr-2 text-gold-deep">{c.name}</span>
            {c.options
              .map((o) => `${o.name} ${live.reduce((n, ord) => n + qty(ord, o.id!), 0)}`)
              .join(' · ')}
          </div>
        ))}
    </section>
  )
}

/* ---------- List and one order ---------- */

function OrderList({
  event,
  orders,
  onChanged,
  onEdit,
}: {
  event: EditableEvent
  orders: ConsoleOrder[]
  onChanged: () => void
  onEdit: (o: ConsoleOrder) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  if (!orders.length) return <p className="text-sm text-stone">No orders here.</p>
  return (
    <ul className="divide-y divide-border border-y border-border">
      {orders.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            aria-expanded={open === o.id}
            onClick={() => setOpen(open === o.id ? null : o.id)}
            className="block w-full px-1 py-4 text-left transition-colors hover:bg-ivory"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-display text-xl text-charcoal">
                {o.name}
                {o.isTest ? <span className="caps ml-2 text-[0.6rem] text-stone">Test</span> : null}
              </span>
              <StatusBadge order={o} />
            </span>
            <span className="mt-1 block text-sm text-stone">
              {o.diners} diner{o.diners === 1 ? '' : 's'} · {o.place} {o.time} · {owed(o)}
            </span>
          </button>
          {open === o.id ? <OrderDetail event={event} order={o} onChanged={onChanged} onEdit={() => onEdit(o)} /> : null}
        </li>
      ))}
    </ul>
  )
}

function OrderDetail({
  event,
  order: o,
  onChanged,
  onEdit,
}: {
  event: EditableEvent
  order: ConsoleOrder
  onChanged: () => void
  onEdit: () => void
}) {
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = o.status === 'held' || o.status === 'awaiting_transfer' || o.status === 'confirmed'

  async function act(action: OrderAction, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    try {
      await send(`/api/manager/orders/${o.id}`, 'PATCH', action)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dishes = event.courses.map((c) => ({
    course: c.name,
    text:
      c.kind === 'fixed'
        ? `${c.options[0]?.name ?? ''} × ${o.diners}`
        : c.options
            .map((opt) => ({ name: opt.name, n: qty(o, opt.id!) }))
            .filter((x) => x.n > 0)
            .map((x) => `${x.name} × ${x.n}`)
            .join(' · '),
  }))

  return (
    <div className="space-y-6 border-t border-dashed border-border bg-ivory px-3 py-5 sm:px-5">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
        <Row label="Dishes">
          {dishes.map((d) => (
            <span key={d.course} className="block">
              <span className="text-stone">{d.course}:</span> {d.text}
            </span>
          ))}
        </Row>
        <Row label="Allergies">{o.allergies || <span className="text-stone">None given</span>}</Row>
        {o.notes ? <Row label="Notes">{o.notes}</Row> : null}
        <Row label="Contact">
          {o.mobile ? (
            <a href={`tel:${o.mobile.replace(/\s/g, '')}`} className="block underline underline-offset-4">
              {o.mobile}
            </a>
          ) : null}
          {o.email ? (
            <a href={`mailto:${o.email}`} className="block break-all underline underline-offset-4">
              {o.email}
            </a>
          ) : null}
        </Row>
        <Row label="Collection">
          {o.place} at {o.time}
        </Row>
        <Row label="Order">
          {SOURCE_LABEL[o.source] ?? o.source} · {o.language === 'fr' ? 'French' : 'English'} · {formatDateTime(o.createdAt)}
        </Row>
        <Row label="Payment">
          Total {money(o.totalCents)} · deposit {money(o.depositCents)} by {METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}{' '}
          {o.depositPaid ? '(paid)' : '(not paid yet)'}
          {o.paymentReference ? <span className="block text-stone">Reference: {o.paymentReference}</span> : null}
          {o.paymentMethod === 'bank_transfer' && !o.depositPaid && o.depositCents > 0 ? (
            <span className="block text-stone">Transfer reference given to the customer: {transferReference(o.id)}</span>
          ) : null}
          {o.collected ? (
            <span className="block">
              Balance {money(o.balanceCents)} paid at collection by {METHOD_LABEL[o.balanceMethod ?? ''] ?? '—'}
            </span>
          ) : null}
          {o.refundStatus !== 'none' ? (
            <span className="block">
              Refund {money(o.refundCents)}: {o.refundStatus === 'refunded' ? 'sent' : 'to send'}
            </span>
          ) : null}
        </Row>
      </dl>

      <div className="space-y-4">
        {o.payingByCard ? (
          <p className="text-sm text-stone">
            {o.name} is paying the deposit by card on Stripe’s page. The order confirms itself when they’ve paid;
            if they don’t, it expires within 30 minutes and the places are freed.
          </p>
        ) : null}

        {(o.status === 'held' || o.status === 'awaiting_transfer') && !o.payingByCard ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Payment reference (optional)"
              placeholder="Reference (optional)"
              className={cn(inputClass, 'w-auto min-w-0 flex-1 basis-48')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <button
              type="button"
              className={buttonStyles('solid', 'px-5 py-2')}
              disabled={busy}
              onClick={() => act({ action: 'deposit_received', reference })}
            >
              Deposit received
            </button>
            {!o.email ? (
              <span className="basis-full text-sm text-stone">
                No email address: the customer won’t get a confirmation email, so let them know yourself.
              </span>
            ) : null}
          </div>
        ) : null}

        {active && !o.collected && !o.payingByCard ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="basis-full text-sm text-charcoal">
              Collected &amp; {o.depositPaid ? `balance ${money(o.balanceCents)}` : `all ${money(o.totalCents)}`} paid by
            </span>
            <button type="button" className={buttonStyles('outline', 'px-4 py-2')} disabled={busy} onClick={() => act({ action: 'collected', method: 'cash' })}>
              Cash
            </button>
            <button type="button" className={buttonStyles('outline', 'px-4 py-2')} disabled={busy} onClick={() => act({ action: 'collected', method: 'cheque' })}>
              Cheque
            </button>
          </div>
        ) : null}

        {o.overdue ? (
          <div className="flex flex-wrap items-center gap-3 border-l-2 border-destructive/60 pl-3">
            <span className="basis-full text-sm text-charcoal">
              The deposit is overdue. {o.name}’s {o.diners} place{o.diners === 1 ? ' is' : 's are'} still held until
              you confirm the deposit or release them.
            </span>
            <button
              type="button"
              className={buttonStyles('outline', 'border-destructive/60 px-5 py-2 text-destructive hover:border-destructive hover:text-destructive')}
              disabled={busy}
              onClick={() =>
                act(
                  { action: 'cancel' },
                  `Release ${o.name}’s ${o.diners} place${o.diners === 1 ? '' : 's'}? The order will be cancelled.`,
                )
              }
            >
              Release places
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {canChangeOrder(o) ? (
            <button type="button" className={buttonStyles('outline', 'px-5 py-2')} disabled={busy} onClick={onEdit}>
              Change order
            </button>
          ) : null}
          {o.collected ? (
            <button type="button" className={buttonStyles('text')} disabled={busy} onClick={() => act({ action: 'undo_collected' })}>
              Undo “collected”
            </button>
          ) : null}
          {o.cardRefundable ? (
            <button
              type="button"
              className={buttonStyles('solid', 'px-5 py-2')}
              disabled={busy}
              onClick={() =>
                act(
                  { action: 'refund_card' },
                  `Refund ${money(cardRefund(o))} to ${o.name}’s card through Stripe? This can’t be undone.`,
                )
              }
            >
              Refund {money(cardRefund(o))} by card
            </button>
          ) : null}
          {o.refundStatus === 'requested' || o.refundStatus === 'partial' ? (
            <button
              type="button"
              className={buttonStyles(o.cardRefundable ? 'text' : 'solid', o.cardRefundable ? '' : 'px-5 py-2')}
              disabled={busy}
              onClick={() =>
                act(
                  { action: 'refund_sent' },
                  o.cardRefundable
                    ? `Mark the refund of ${money(o.refundCents)} to ${o.name} as sent, without refunding through Stripe (e.g. you already refunded it in Stripe yourself)?`
                    : `Mark the refund of ${money(o.refundCents)} to ${o.name} as sent?`,
                )
              }
            >
              {o.cardRefundable ? 'Already refunded: mark as sent' : 'Refund sent'}
            </button>
          ) : null}
          {active && !o.overdue ? (
            <button
              type="button"
              className={buttonStyles('outline', 'border-destructive/60 px-5 py-2 text-destructive hover:border-destructive hover:text-destructive')}
              disabled={busy}
              onClick={() =>
                act(
                  { action: 'cancel' },
                  `Cancel ${o.name}’s order for ${o.diners}? Their places will be freed.` +
                    (o.depositPaid && o.depositCents > 0
                      ? o.paymentMethod === 'card' && o.source === 'website'
                        ? ` It will be marked “refund to send”, and you can then refund the card through Stripe.`
                        : ` It will be marked “refund to send”.`
                      : ''),
                )
              }
            >
              Cancel order
            </button>
          ) : null}
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}

/* ---------- Add an order, or change one (issue #21) ---------- */

function AddOrder({
  event,
  order,
  placesLeft: placesLeftForAll,
  onDone,
}: {
  event: EditableEvent
  /** The order being changed; empty when adding a new one. */
  order?: ConsoleOrder | null
  placesLeft: number
  onDone: (saved: boolean) => void
}) {
  // When changing an order, its own places count as free for it.
  const placesLeft = placesLeftForAll + (order?.takesPlaces ? order.diners : 0)
  const [f, setF] = useState({
    collectionPointId: order?.collectionPointId ?? event.collectionPoints[0]?.id ?? '',
    diners: order?.diners ?? 2,
    name: order?.name ?? '',
    mobile: order?.mobile ?? '',
    email: order?.email ?? '',
    allergies: order?.allergies ?? '',
    notes: order?.notes ?? '',
    language: order?.language ?? ('fr' as 'en' | 'fr'),
    source: 'phone',
    paymentMethod: 'cash',
    depositPaid: false,
    reference: '',
    marketing: false,
    overbook: false,
  })
  const [choices, setChoices] = useState<Record<string, number>>(() =>
    Object.fromEntries((order?.lines ?? []).map((l) => [l.optionId, l.quantity])),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...patch }))
    setError('')
  }

  const choiceCourses = event.courses.filter((c) => c.kind === 'choice')
  const tallies = useMemo(
    () =>
      choiceCourses.map((c) => c.options.reduce((n, o) => n + (choices[o.id!] ?? 0), 0)),
    [choiceCourses, choices],
  )
  const dishesOk = tallies.every((t) => t === f.diners)
  // Fewer diners (or the same) never needs "Book anyway", even on a full evening.
  const over = f.diners > placesLeft && (!order || f.diners > order.diners)
  const newMoney = order ? repriceOrder(order, f.diners) : null

  async function save() {
    setBusy(true)
    setError('')
    try {
      if (order) await send(`/api/manager/orders/${order.id}`, 'PUT', { ...f, choices })
      else await send('/api/manager/orders', 'POST', { ...f, eventId: event.id, choices })
      onDone(true)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  if (!event.collectionPoints.length)
    return <p className="text-sm text-stone">Add a collection point to this evening (in Events) first.</p>

  return (
    <section className="space-y-8 border border-border bg-ivory px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h2 className="text-3xl text-charcoal">{order ? `Change ${order.name}’s order` : 'Add an order'}</h2>
        <p className="text-sm text-stone">
          {order
            ? `${Math.max(placesLeft, 0)} place${placesLeft === 1 ? '' : 's'} available for this order (including its own ${order.diners}). The customer isn’t emailed about the change: please let them know yourself.`
            : placesLeft > 0
              ? `${placesLeft} place${placesLeft === 1 ? '' : 's'} left.`
              : 'No places left.'}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {!order ? (
          <Field label="Came in by">
            <select className={inputClass} value={f.source} onChange={(e) => set({ source: e.target.value })}>
              {['phone', 'whatsapp', 'email', 'messenger', 'in_person'].map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Collection point">
          <select className={inputClass} value={f.collectionPointId} onChange={(e) => set({ collectionPointId: e.target.value })}>
            {event.collectionPoints.map((p) => (
              <option key={p.id} value={p.id!}>
                {p.place} {p.time}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-charcoal">Diners</span>
        <Counter value={f.diners} min={1} max={100} onChange={(n) => set({ diners: n, overbook: false })} label="diners" />
        {over ? (
          <div className="space-y-2 border border-destructive/50 px-4 py-3 text-sm text-destructive">
            <p>
              This would overbook the evening by {f.diners - Math.max(placesLeft, 0)}{' '}
              {placesLeft > 0 ? `(only ${placesLeft} left)` : '(no places left)'}.
            </p>
            <label className="flex cursor-pointer gap-3 text-charcoal">
              <input type="checkbox" className="tick mt-0.5" checked={f.overbook} onChange={(e) => set({ overbook: e.target.checked })} />
              Book anyway
            </label>
          </div>
        ) : null}
      </div>

      {choiceCourses.map((c, ci) => (
        <div key={c.id} className="space-y-3">
          <p className="text-sm text-charcoal">
            {c.name}:{' '}
            <span className={tallies[ci] === f.diners ? 'text-gold-deep' : 'text-destructive'}>
              {tallies[ci]} of {f.diners} chosen
            </span>
          </p>
          {c.options.map((o) => (
            <div key={o.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-sm text-charcoal">
                {o.name}
                {o.vegetarian ? ' (v)' : ''}
              </span>
              <Counter
                value={choices[o.id!] ?? 0}
                min={0}
                max={f.diners}
                onChange={(n) => setChoices((x) => ({ ...x, [o.id!]: n }))}
                label={o.name}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClass} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <input type="tel" className={inputClass} value={f.mobile} onChange={(e) => set({ mobile: e.target.value })} />
        </Field>
        <Field label={order?.source === 'website' ? 'Email' : 'Email (optional)'}>
          <input type="email" className={inputClass} value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Language">
          <select className={inputClass} value={f.language} onChange={(e) => set({ language: e.target.value as 'en' | 'fr' })}>
            <option value="fr">French</option>
            <option value="en">English</option>
          </select>
        </Field>
      </div>
      <Field label="Allergies or dietary needs">
        <textarea rows={2} className={inputClass} value={f.allergies} onChange={(e) => set({ allergies: e.target.value })} />
      </Field>
      <Field label="Notes (only you see these)">
        <textarea rows={2} className={inputClass} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>

      {order && newMoney ? (
        <ChangedMoney order={order} diners={f.diners} money={newMoney} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Total {money(event.priceCents * f.diners)} · deposit {money(event.depositCents * f.diners)}
          </p>
          <Field label="Deposit paid by">
            <select className={inputClass} value={f.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}>
              {['cash', 'cheque', 'bank_transfer', 'card'].map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex cursor-pointer gap-3 text-sm text-charcoal">
            <input type="checkbox" className="tick mt-0.5" checked={f.depositPaid} onChange={(e) => set({ depositPaid: e.target.checked })} />
            The deposit has already been paid
          </label>
          {f.depositPaid ? (
            <Field label="Reference (optional)">
              <input className={inputClass} value={f.reference} onChange={(e) => set({ reference: e.target.value })} />
            </Field>
          ) : null}
          {f.email ? (
            <label className="flex cursor-pointer gap-3 text-sm text-charcoal">
              <input type="checkbox" className="tick mt-0.5" checked={f.marketing} onChange={(e) => set({ marketing: e.target.checked })} />
              They agreed to receive new box dates and other news by email
            </label>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={buttonStyles('solid', 'px-10')}
          onClick={save}
          disabled={busy || !dishesOk || (over && !f.overbook)}
        >
          {busy ? 'Saving…' : order ? 'Save changes' : 'Save order'}
        </button>
        <button type="button" className={buttonStyles('text')} onClick={() => onDone(false)}>
          Cancel
        </button>
        {!dishesOk ? <p className="text-sm text-stone">Choose a dish for every diner first.</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </section>
  )
}

/** What changing the diners does to the money (issue #21). */
function ChangedMoney({ order: o, diners, money: m }: { order: ConsoleOrder; diners: number; money: ReturnType<typeof repriceOrder> }) {
  const pendingBefore = o.refundStatus === 'requested' ? o.refundCents : 0
  return (
    <div className="space-y-2 text-sm text-charcoal">
      <p>
        Total {money(m.totalCents)} · deposit {money(m.depositCents)}{' '}
        {o.depositPaid ? '(paid)' : '(not paid yet)'} · {money(m.balanceCents)} at collection
      </p>
      {diners !== o.diners ? (
        <p className="text-stone">
          Was {money(o.totalCents)} for {o.diners} diner{o.diners === 1 ? '' : 's'}, at the price per person when they ordered.
          {o.depositPaid && m.refundCents === pendingBefore && diners > o.diners
            ? ' The deposit already paid stays as it is; the extra is paid at collection.'
            : ''}
        </p>
      ) : null}
      {m.refundCents !== pendingBefore ? (
        <p className={m.refundCents > 0 ? 'text-destructive' : 'text-stone'}>
          {m.refundCents > 0
            ? `${money(m.refundCents)} of the deposit paid will be marked “refund to send”.`
            : 'No refund will be owed any more.'}
        </p>
      ) : null}
    </div>
  )
}

/* ---------- Small pieces ---------- */

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm text-charcoal">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="caps pt-0.5 text-[0.65rem] text-stone">{label}</dt>
      <dd className="text-charcoal">{children}</dd>
    </>
  )
}

function Counter({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  label: string
}) {
  const btn =
    'flex size-10 items-center justify-center border border-stone/40 text-lg text-charcoal transition-colors hover:border-gold hover:text-gold-deep disabled:opacity-30'
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
        −
      </button>
      <span aria-live="polite" className="min-w-6 text-center font-display text-2xl tabular-nums text-charcoal">
        {value}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  )
}

function StatusBadge({ order: o }: { order: ConsoleOrder }) {
  const [label, tone] = statusOf(o)
  return (
    <span
      className={cn(
        'caps text-[0.6rem]',
        tone === 'good' && 'text-gold-deep',
        tone === 'alert' && 'text-destructive',
        tone === 'muted' && 'text-stone',
      )}
    >
      {label}
    </span>
  )
}

/* ---------- Helpers ---------- */

function statusOf(o: ConsoleOrder): [string, 'good' | 'alert' | 'muted' | 'plain'] {
  if (o.status === 'cancelled') {
    if (o.refundStatus === 'requested' || o.refundStatus === 'partial') return ['Cancelled · refund to send', 'alert']
    if (o.refundStatus === 'refunded') return ['Cancelled · refunded', 'muted']
    return ['Cancelled', 'muted']
  }
  if (o.status === 'expired') return ['Expired', 'muted']
  if (o.collected) return ['Collected', 'muted']
  if (o.depositPaid) return ['Deposit paid', 'good']
  if (o.overdue) return ['Deposit overdue', 'alert']
  if (o.payingByCard) return ['Paying by card…', 'plain']
  return ['Waiting for deposit', 'plain']
}

/** One line saying what is still owed (or to be refunded). */
function owed(o: ConsoleOrder): string {
  if (o.status === 'cancelled' || o.status === 'expired') {
    if (o.refundStatus === 'requested' || o.refundStatus === 'partial') return `refund ${money(o.refundCents)} to send`
    return 'nothing owed'
  }
  // A refund owed after fewer diners (issue #21).
  const refund = o.refundStatus === 'requested' || o.refundStatus === 'partial' ? ` · refund ${money(o.refundCents)} to send` : ''
  if (o.collected) return 'paid in full' + refund
  if (!o.depositPaid && o.depositCents > 0)
    return `deposit ${money(o.depositCents)} due, then ${money(o.balanceCents)} at collection`
  return `${money(o.balanceCents)} due at collection` + refund
}

function matches(o: ConsoleOrder, f: Filter): boolean {
  const live = o.status !== 'cancelled' && o.status !== 'expired'
  switch (f) {
    case 'active':
      return live
    case 'waiting':
      return live && !o.depositPaid && !o.collected
    case 'paid':
      return live && o.depositPaid && !o.collected
    case 'collected':
      return live && o.collected
    case 'cancelled':
      return !live
  }
}

/** The part of a refund that goes back by card (a balance paid at collection was cash or cheque). */
function cardRefund(o: ConsoleOrder) {
  return o.refundCents - (o.balanceMethod && o.collected ? o.balanceCents : 0)
}

function takenBy(orders: ConsoleOrder[]) {
  return orders.filter((o) => o.takesPlaces).reduce((n, o) => n + o.diners, 0)
}

function qty(o: ConsoleOrder, optionId: string) {
  return o.lines.find((l) => l.optionId === optionId)?.quantity ?? 0
}

function money(c: number) {
  return '€' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100))
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Paris',
  })
}

function formatDateTime(d: string) {
  const [date, time] = d.split('T')
  return `${formatDate(date)}, ${time}`
}
