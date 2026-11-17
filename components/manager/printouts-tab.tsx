'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { EditableEvent } from '@/lib/event-editing'
import type { EventListItem } from '@/lib/manager-events'
import type { ConsoleOrder } from '@/lib/order-editing'
import { cn } from '@/lib/utils'

/*
 * Console → Printouts: prep list, collection run sheet and box labels for one
 * evening. Only the sheet on screen is printed; controls are print:hidden.
 * Confirmed orders only by default; orders waiting for a deposit are listed
 * separately unless "Include orders waiting for deposit" is ticked.
 */

type Sheet = 'prep' | 'run' | 'labels'
const SHEETS: { id: Sheet; label: string }[] = [
  { id: 'prep', label: 'Prep list' },
  { id: 'run', label: 'Run sheet' },
  { id: 'labels', label: 'Box labels' },
]

export function PrintoutsTab() {
  const events = useSWR<{ events?: EventListItem[] }>('/api/manager/events', fetcher)
  const [eventId, setEventId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>('prep')
  const [includeWaiting, setIncludeWaiting] = useState(false)

  useEffect(() => {
    const list = events.data?.events
    if (!eventId && list?.length) setEventId(defaultEventId(list))
  }, [events.data, eventId])

  const detail = useSWR<{ event?: EditableEvent }>(eventId ? `/api/manager/events/${eventId}` : null, fetcher)
  const orders = useSWR<{ orders?: ConsoleOrder[] }>(eventId ? `/api/manager/orders?event=${eventId}` : null, fetcher)

  const list = events.data?.events
  if (!list) return <p className="text-sm text-stone">Loading…</p>
  if (!list.length) return <p className="text-sm text-stone">No evenings yet.</p>

  const event = detail.data?.event
  const all = orders.data?.orders
  const confirmed = all?.filter((o) => o.status === 'confirmed') ?? []
  const waiting = all?.filter(isWaiting) ?? []

  return (
    <div className="space-y-8">
      <div className="space-y-5 print:hidden">
        <label className="block space-y-1.5">
          <span className="block text-sm text-charcoal">Evening</span>
          <select className={inputClass} value={eventId ?? ''} onChange={(e) => setEventId(e.target.value)}>
            {list.map((e) => (
              <option key={e.id} value={e.id}>
                {formatDate(e.date)} · {e.title}
                {e.status === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sheet">
          {SHEETS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sheet === s.id}
              onClick={() => setSheet(s.id)}
              className={cn(
                'border px-4 py-2 text-sm transition-colors',
                sheet === s.id ? 'border-charcoal bg-charcoal text-ivory' : 'border-stone/40 text-charcoal hover:border-gold',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {sheet !== 'prep' ? (
            <label className="flex cursor-pointer gap-3 text-sm text-charcoal">
              <input
                type="checkbox"
                className="tick mt-0.5"
                checked={includeWaiting}
                onChange={(e) => setIncludeWaiting(e.target.checked)}
              />
              Include orders waiting for deposit ({waiting.length})
            </label>
          ) : (
            <span />
          )}
          <button type="button" className={buttonStyles('solid')} onClick={() => window.print()} disabled={!event || !all}>
            Print
          </button>
        </div>
      </div>

      {/* A4 with comfortable margins (labels set their own, to match label sheets). */}
      {sheet !== 'labels' ? <style>{`@media print { @page { size: A4; margin: 14mm 12mm; } }`}</style> : null}

      {!event || !all ? (
        <p className="text-sm text-stone">Loading…</p>
      ) : sheet === 'prep' ? (
        <PrepList event={event} confirmed={confirmed} waiting={waiting} />
      ) : sheet === 'run' ? (
        <RunSheet event={event} orders={includeWaiting ? [...confirmed, ...waiting] : confirmed} left={includeWaiting ? [] : waiting} />
      ) : (
        <Labels event={event} orders={includeWaiting ? [...confirmed, ...waiting] : confirmed} left={includeWaiting ? [] : waiting} />
      )}
    </div>
  )
}

/* ---------- Prep list ---------- */

function PrepList({ event, confirmed, waiting }: { event: EditableEvent; confirmed: ConsoleOrder[]; waiting: ConsoleOrder[] }) {
  const diners = (os: ConsoleOrder[]) => os.reduce((n, o) => n + o.diners, 0)
  const count = (os: ConsoleOrder[], optionId: string) => os.reduce((n, o) => n + qty(o, optionId), 0)
  const notes = [...confirmed, ...waiting].filter((o) => hasAllergy(o.allergies)).sort(byCollection)

  return (
    <article className="space-y-8 text-charcoal">
      <SheetTitle event={event} title="Prep list" />

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-charcoal text-left">
            <th className="py-2 pr-2 font-normal">Dish</th>
            <th className="w-20 py-2 text-right font-normal">Confirmed</th>
            <th className="w-20 py-2 text-right font-normal text-stone print:text-black">Waiting</th>
            <th className="w-16 py-2 text-right font-normal">Total</th>
          </tr>
        </thead>
        {event.courses.map((c) => (
          <tbody key={c.id} className="break-inside-avoid">
            <tr>
              <td colSpan={4} className="caps pt-4 pb-1 text-[0.65rem] text-gold-deep print:text-black">
                {c.name}
              </td>
            </tr>
            {c.options.map((o) => {
              const a = c.kind === 'fixed' ? diners(confirmed) : count(confirmed, o.id!)
              const b = c.kind === 'fixed' ? diners(waiting) : count(waiting, o.id!)
              return (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-1.5 pr-2">
                    {o.name}
                    {o.vegetarian ? ' (v)' : ''}
                  </td>
                  <td className="py-1.5 text-right font-display text-xl tabular-nums">{a}</td>
                  <td className="py-1.5 text-right tabular-nums text-stone print:text-black">{b || '–'}</td>
                  <td className="py-1.5 text-right tabular-nums">{a + b}</td>
                </tr>
              )
            })}
          </tbody>
        ))}
        <tbody>
          <tr className="border-t-2 border-charcoal">
            <td className="py-2">Diners</td>
            <td className="py-2 text-right font-display text-xl tabular-nums">{diners(confirmed)}</td>
            <td className="py-2 text-right tabular-nums text-stone print:text-black">{diners(waiting) || '–'}</td>
            <td className="py-2 text-right tabular-nums">{diners(confirmed) + diners(waiting)}</td>
          </tr>
        </tbody>
      </table>

      <section className="break-inside-avoid space-y-2">
        <h3 className="caps text-gold-deep print:text-black">Boxes per collection point</h3>
        <ul className="text-sm">
          {event.collectionPoints.map((p) => {
            const here = confirmed.filter((o) => o.collectionPointId === p.id)
            const wait = waiting.filter((o) => o.collectionPointId === p.id)
            return (
              <li key={p.id} className="flex justify-between gap-4 border-b border-border py-1.5">
                <span>
                  {p.time} {p.place}
                </span>
                <span className="tabular-nums">
                  {here.length} order{here.length === 1 ? '' : 's'} · {diners(here)} diners
                  {wait.length ? ` (+${diners(wait)} waiting)` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="caps text-gold-deep print:text-black">Allergies &amp; dietary notes</h3>
        {notes.length ? (
          <ul className="divide-y divide-border border-y border-border text-sm">
            {notes.map((o) => (
              <li key={o.id} className="break-inside-avoid py-2">
                <span className="font-medium">{o.name}</span>
                <span className="text-stone print:text-black">
                  {' '}
                  · {o.diners} diner{o.diners === 1 ? '' : 's'} · {o.time} {o.place}
                  {isWaiting(o) ? ' · waiting for deposit' : ''}
                </span>
                <span className="block font-semibold">{o.allergies}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone">None.</p>
        )}
      </section>
    </article>
  )
}

/* ---------- Run sheet ---------- */

function RunSheet({ event, orders, left }: { event: EditableEvent; orders: ConsoleOrder[]; left: ConsoleOrder[] }) {
  const choiceCourses = event.courses.filter((c) => c.kind === 'choice')
  return (
    <article className="space-y-8 text-charcoal">
      <SheetTitle event={event} title="Collection run sheet" />
      {event.collectionPoints.map((p) => {
        const here = orders.filter((o) => o.collectionPointId === p.id).sort(byName)
        return (
          <section key={p.id} className="space-y-1">
            <h3 className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-charcoal pb-1 font-display text-2xl break-after-avoid">
              <span className="tabular-nums">{p.time}</span> {p.place}
              <span className="font-sans text-sm text-stone print:text-black">
                {here.length} order{here.length === 1 ? '' : 's'} · {here.reduce((n, o) => n + o.diners, 0)} diners
              </span>
            </h3>
            <p className="text-sm text-stone print:text-black">{p.address}</p>
            {here.length ? (
              <ul className="divide-y divide-border">
                {here.map((o) => (
                  <li key={o.id} className="flex break-inside-avoid gap-3 py-2.5 text-sm">
                    <span aria-hidden className="mt-0.5 size-5 shrink-0 border-2 border-charcoal" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span>
                          <span className="font-display text-lg">{o.name}</span> · {o.diners} diner{o.diners === 1 ? '' : 's'}
                        </span>
                        <span className="font-semibold tabular-nums">Collect {money(toCollect(o))}</span>
                      </p>
                      <p className="text-stone print:text-black">
                        {o.mobile}
                        {isWaiting(o) ? ' · DEPOSIT NOT PAID' : ''}
                      </p>
                      {choiceCourses.map((c) => (
                        <p key={c.id}>
                          {c.name}: {dishLine(o, c.options)}
                        </p>
                      ))}
                      {hasAllergy(o.allergies) ? <p className="font-semibold">Allergies: {o.allergies}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-stone">No orders.</p>
            )}
          </section>
        )
      })}
      <WaitingList orders={left} />
    </article>
  )
}

/* ---------- Box labels ---------- */

// Standard 8-per-A4 label sheets: 2 × 4 labels of 99.1 × 67.7 mm.
const PER_PAGE = 8

function Labels({ event, orders, left }: { event: EditableEvent; orders: ConsoleOrder[]; left: ConsoleOrder[] }) {
  const sorted = [...orders].sort(byCollection)
  const pages: ConsoleOrder[][] = []
  for (let i = 0; i < sorted.length; i += PER_PAGE) pages.push(sorted.slice(i, i + PER_PAGE))
  const choiceCourses = event.courses.filter((c) => c.kind === 'choice')

  return (
    <div className="space-y-6 text-charcoal">
      {/* Page margins that line up with standard label sheets. */}
      <style>{`@media print { @page { size: A4; margin: 12.9mm 4.6mm 0 4.6mm; } }`}</style>
      <p className="text-sm text-stone print:hidden">
        {sorted.length} label{sorted.length === 1 ? '' : 's'} on {pages.length} A4 page{pages.length === 1 ? '' : 's'} (8 per page, for
        99 × 68 mm label sheets or plain paper). In the print window, set margins to “Default” and scale to 100%.
      </p>
      {pages.map((page, pi) => (
        <div
          key={pi}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-[99.1mm_99.1mm] print:grid-rows-[repeat(4,67.7mm)] print:gap-x-[2.5mm] print:gap-y-0 print:[&:not(:last-child)]:break-after-page"
        >
          {page.map((o) => (
            <div
              key={o.id}
              className="flex flex-col overflow-hidden border border-stone/40 bg-ivory px-4 py-3 print:h-[67.7mm] print:border-0 print:bg-white print:px-[5mm] print:py-[4mm]"
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate font-display text-xl leading-tight">{o.name}</span>
                <span className="shrink-0 text-sm">× {o.diners}</span>
              </p>
              <p className="text-sm">
                {o.time} {o.place}
                {isWaiting(o) ? ' · deposit not paid' : ''}
              </p>
              <div className="mt-1.5 space-y-0.5 text-[0.8rem] leading-snug">
                {choiceCourses.map((c) => (
                  <p key={c.id}>
                    <span className="text-stone print:text-black">{c.name}:</span> {dishLine(o, c.options)}
                  </p>
                ))}
              </div>
              {hasAllergy(o.allergies) ? (
                <p className="mt-1.5 line-clamp-3 border-t border-charcoal pt-1 text-[0.8rem] font-semibold leading-snug">
                  ALLERGIES: {o.allergies}
                </p>
              ) : null}
              <p className="mt-auto pt-1 text-[0.65rem] text-stone print:text-black">
                {event.title} · {formatDate(event.date)}
              </p>
            </div>
          ))}
        </div>
      ))}
      {!sorted.length ? <p className="text-sm text-stone">No orders to label.</p> : null}
      <div className="print:hidden">
        <WaitingList orders={left} />
      </div>
    </div>
  )
}

/* ---------- Shared pieces ---------- */

function SheetTitle({ event, title }: { event: EditableEvent; title: string }) {
  return (
    <header className="space-y-1 border-b border-border pb-4">
      <p className="caps text-gold-deep print:text-black">{title}</p>
      <h2 className="font-display text-3xl">{event.title}</h2>
      <p className="text-sm text-stone print:text-black">
        {formatDate(event.date)} · printed {new Date().toLocaleString('en-GB', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}
      </p>
    </header>
  )
}

function WaitingList({ orders }: { orders: ConsoleOrder[] }) {
  if (!orders.length) return null
  return (
    <section className="break-inside-avoid space-y-2 border border-dashed border-stone/60 px-4 py-3 text-sm">
      <h3 className="caps text-stone print:text-black">Waiting for deposit · not included above</h3>
      <ul className="space-y-1">
        {orders.map((o) => (
          <li key={o.id}>
            {o.name} · {o.diners} diner{o.diners === 1 ? '' : 's'} · {o.time} {o.place} · {o.mobile}
            {hasAllergy(o.allergies) ? <span className="block font-semibold">Allergies: {o.allergies}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- Helpers ---------- */

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

/** The next evening to come, or the latest one if none are coming. */
export function defaultEventId(list: EventListItem[]): string {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const upcoming = list.filter((e) => e.date >= today && e.status !== 'draft')
  return (upcoming[upcoming.length - 1] ?? list[0]).id
}

function isWaiting(o: ConsoleOrder) {
  return (o.status === 'held' || o.status === 'awaiting_transfer') && o.takesPlaces
}

/** Ignores answers like "none", "no", "aucune", "-" in the allergies box. */
function hasAllergy(text: string) {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, '')
  return Boolean(t) && !/^(none|no|non|nil|nope|nothing|n\/?a|-+|aucune?s?|rien|pas d['’]allergies?|no allergies?|none known)$/.test(t)
}

function qty(o: ConsoleOrder, optionId: string) {
  return o.lines.find((l) => l.optionId === optionId)?.quantity ?? 0
}

function dishLine(o: ConsoleOrder, options: { id: string | null; name: string }[]) {
  return options
    .map((opt) => ({ name: opt.name, n: qty(o, opt.id!) }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.name} × ${x.n}`)
    .join(' · ')
}

/** What to collect at the door: the balance, or everything if the deposit is unpaid. */
function toCollect(o: ConsoleOrder) {
  if (o.collected) return 0
  return o.depositPaid ? o.balanceCents : o.totalCents
}

function byName(a: ConsoleOrder, b: ConsoleOrder) {
  return a.name.localeCompare(b.name)
}

function byCollection(a: ConsoleOrder, b: ConsoleOrder) {
  return a.time.localeCompare(b.time) || a.place.localeCompare(b.place) || byName(a, b)
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
