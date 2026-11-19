'use client'

import type { ReactNode } from 'react'
import { buttonStyles } from '@/components/site/button-styles'
import { attentionLines, ordersAndDiners, type EveningSummary } from '@/lib/evening-summary'
import { cn } from '@/lib/utils'

/*
 * Console → Events, under the list: live evenings at a glance (issue #44).
 * Open, sold out or orders closed; not drafts or done. Test evenings show,
 * tagged, so the page can be tried out (the Monday email leaves them out).
 */

const STATUS: Record<string, string> = { open: 'Open for orders', sold_out: 'Sold out', closed: 'Orders closed' }

export function LiveEvenings({
  evenings,
  error,
  onOrders,
}: {
  evenings?: EveningSummary[]
  error?: unknown
  onOrders: (id: string) => void
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl text-charcoal">At a glance</h2>
        <p className="mt-1 text-sm text-stone">Every live evening: open, sold out or orders closed. Not drafts or evenings marked done.</p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">The summary couldn’t be loaded. Please refresh the page.</p>
      ) : !evenings ? (
        <p className="text-sm text-stone">Loading…</p>
      ) : evenings.length === 0 ? (
        <p className="border border-border bg-ivory px-6 py-8 text-center text-stone">No live evenings at the moment.</p>
      ) : (
        <div className="space-y-6">
          {evenings.map((e) => (
            <Evening key={e.id} e={e} onOrders={() => onOrders(e.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function Evening({ e, onOrders }: { e: EveningSummary; onOrders: () => void }) {
  const left = Math.max(0, e.capacity - e.placesTaken)
  const attention = attentionLines(e, euros)
  return (
    <article className="space-y-5 border border-border bg-ivory px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-charcoal">
            {e.title}
            {e.isTest ? <span className="caps ml-3 align-middle text-[0.6rem] text-stone">Test</span> : null}
          </h3>
          <p className="mt-1 text-sm text-stone">
            {formatDate(e.date)} · <span className={e.status === 'open' ? 'text-gold-deep' : undefined}>{STATUS[e.status]}</span>
            {' · '}last orders {formatCutoff(e.cutoff)}
          </p>
        </div>
        <button type="button" className={buttonStyles('outline')} onClick={onOrders}>
          See orders
        </button>
      </header>

      <div>
        <p className="font-display text-xl text-charcoal">
          {e.placesTaken} / {e.capacity} places taken
          <span className="ml-2 text-base text-stone">· {left} left</span>
        </p>
        <div className="mt-2 h-1 w-full bg-border" aria-hidden>
          <div className="h-1 bg-gold" style={{ width: `${Math.min(100, (e.placesTaken / Math.max(1, e.capacity)) * 100)}%` }} />
        </div>
      </div>

      {attention.length ? (
        <p className="border-l-2 border-gold pl-3 text-sm text-charcoal">
          <span className="caps mr-2 text-[0.65rem] text-gold-deep">Needs attention</span>
          {attention.join(' · ')}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Block title="Orders">
          <Row label="Confirmed" value={ordersAndDiners(e.confirmed)} />
          <Row label="Awaiting deposit" value={ordersAndDiners(e.waiting)} />
          {e.payingByCard ? <Row label="Paying by card now" value={String(e.payingByCard)} /> : null}
          {e.week.newOrders || e.week.cancelled ? (
            <Row
              label="Last 7 days"
              value={`${e.week.newOrders} new · ${e.week.cancelled} cancelled`}
            />
          ) : null}
        </Block>

        <Block title="Money">
          <Row label="Deposits received" value={euros(e.depositsPaidCents)} />
          <Row label="Balance to collect" value={euros(e.balanceDueCents)} />
          {e.refunds.orders ? <Row label="Refunds to send" value={euros(e.refunds.cents)} alert /> : null}
        </Block>

        {e.choices.length ? (
          <Block title="Dishes chosen">
            {e.choices.map((c) => (
              <div key={c.course} className="space-y-1">
                {e.choices.length > 1 ? <p className="caps text-[0.65rem] text-stone">{c.course}</p> : null}
                {c.dishes.map((d) => (
                  <Row key={d.name} label={d.name} value={String(d.count)} />
                ))}
              </div>
            ))}
          </Block>
        ) : null}

        <Block title="Collection points">
          {e.points.length ? (
            e.points.map((p) => <Row key={`${p.place}-${p.time}`} label={`${p.time} ${p.place}`} value={`${p.diners} diner${p.diners === 1 ? '' : 's'}`} />)
          ) : (
            <p className="text-sm text-stone">None set.</p>
          )}
        </Block>
      </div>
    </article>
  )
}

/* ---------- Small pieces ---------- */

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="caps border-b border-border pb-1 text-[0.7rem] text-gold-deep">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <p className="flex justify-between gap-4 text-sm">
      <span className="text-stone">{label}</span>
      <span className={cn('shrink-0 text-right', alert ? 'text-destructive' : 'text-charcoal')}>{value}</span>
    </p>
  )
}

function euros(cents: number) {
  return `€${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "2026-11-26 23:59" → "Thu 26 Nov, 23:59" */
function formatCutoff(c: string) {
  const [date, time] = c.split(' ')
  const day = new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${day}, ${time}`
}
