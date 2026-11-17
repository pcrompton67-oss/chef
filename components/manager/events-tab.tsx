'use client'

import { useEffect, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import {
  IMAGES,
  type EditableCourse,
  type EditableEvent,
  type EventFacts,
  type ManagerStatus,
} from '@/lib/event-editing'
import type { EventListItem } from '@/lib/manager-events'
import { cn } from '@/lib/utils'

/* Console → Events: list, create, edit, duplicate, open/close and delete test evenings. */

const STATUS_LABEL: Record<ManagerStatus, string> = {
  draft: 'Draft (hidden)',
  open: 'Open for orders',
  sold_out: 'Sold out',
  closed: 'Orders closed',
  done: 'Done',
}

// The buttons offered to move an evening from one status to another.
const STATUS_ACTIONS: { to: ManagerStatus; label: string; help: string }[] = [
  { to: 'open', label: 'Open for orders', help: 'Shows on the website and takes orders.' },
  { to: 'sold_out', label: 'Mark sold out', help: 'Still shown, but no more orders. (It also shows sold out by itself when every place is taken.)' },
  { to: 'closed', label: 'Close orders', help: 'Still shown, but no more orders.' },
  { to: 'done', label: 'Mark done', help: 'The evening has happened; shown under past evenings.' },
  { to: 'draft', label: 'Back to draft', help: 'Hidden from the website.' },
]

type View = { kind: 'list' } | { kind: 'edit'; id: string } | { kind: 'new'; start: EditableEvent; n: number }

export function EventsTab() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const list = useSWR<{ events?: EventListItem[]; error?: string }>('/api/manager/events', fetcher)

  const back = () => {
    setView({ kind: 'list' })
    list.mutate()
    window.scrollTo(0, 0)
  }

  if (view.kind === 'list') {
    return (
      <EventList
        events={list.data?.events}
        error={list.error || list.data?.error}
        onOpen={(id) => setView({ kind: 'edit', id })}
        onNew={() => setView({ kind: 'new', start: blankEvent(), n: Date.now() })}
      />
    )
  }
  return (
    <EventEditor
      key={view.kind === 'edit' ? view.id : `new-${view.n}`}
      id={view.kind === 'edit' ? view.id : null}
      start={view.kind === 'new' ? view.start : null}
      onBack={back}
      onCreated={(id) => {
        list.mutate()
        setView({ kind: 'edit', id })
      }}
      onDuplicate={(copy) => {
        setView({ kind: 'new', start: copy, n: Date.now() })
        window.scrollTo(0, 0)
      }}
    />
  )
}

/* ---------- List ---------- */

function EventList({
  events,
  error,
  onOpen,
  onNew,
}: {
  events?: EventListItem[]
  error?: unknown
  onOpen: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl text-charcoal">Evenings</h2>
        <button type="button" className={buttonStyles('solid')} onClick={onNew}>
          New evening
        </button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">The evenings couldn’t be loaded. Please refresh the page.</p>
      ) : !events ? (
        <p className="text-sm text-stone">Loading…</p>
      ) : events.length === 0 ? (
        <p className="border border-border bg-ivory px-6 py-10 text-center text-stone">
          No evenings yet. Press “New evening” to create the first one.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpen(e.id)}
                className="block w-full px-1 py-4 text-left transition-colors hover:bg-ivory"
              >
                <span className="block font-display text-xl text-charcoal">
                  {e.title}
                  {e.isTest ? <TestTag /> : null}
                </span>
                <span className="mt-1 block text-sm text-stone">
                  {formatDate(e.date)} · <StatusLabel status={e.status} /> · {e.placesTaken}/{e.capacity} places
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Editor ---------- */

// The form keeps money and numbers as typed, so "42,50" can be half-typed.
type Form = Omit<EditableEvent, 'priceCents' | 'depositCents' | 'capacity'> & {
  price: string
  deposit: string
  capacity: string
}

function EventEditor({
  id,
  start,
  onBack,
  onCreated,
  onDuplicate,
}: {
  id: string | null
  start: EditableEvent | null
  onBack: () => void
  onCreated: (id: string) => void
  onDuplicate: (copy: EditableEvent) => void
}) {
  const remote = useSWR<{ event?: EditableEvent; facts?: EventFacts; error?: string }>(
    id ? `/api/manager/events/${id}` : null,
    fetcher,
  )
  const [form, setForm] = useState<Form | null>(start ? toForm(start) : null)
  const [slugTouched, setSlugTouched] = useState(Boolean(id))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Fill the form once the saved evening has loaded (and after each save).
  useEffect(() => {
    if (remote.data?.event && !dirty) setForm(toForm(remote.data.event))
  }, [remote.data, dirty])

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (id && (remote.error || remote.data?.error))
    return <p className="text-sm text-destructive">This evening couldn’t be loaded.</p>
  if (!form) return <p className="text-sm text-stone">Loading…</p>

  const facts = remote.data?.facts
  const isNew = !id
  const usedOptions = new Set(facts?.usedOptionIds ?? [])
  const usedPoints = new Set(facts?.usedPointIds ?? [])

  const update = (patch: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...patch } : f))
    setDirty(true)
    setMessage(null)
  }
  const setCourses = (courses: EditableCourse[]) => update({ courses })
  const setCourse = (i: number, patch: Partial<EditableCourse>) =>
    setCourses(form.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  const leave = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    onBack()
  }

  async function save() {
    if (!form) return
    const event = fromForm(form)
    if (!event) {
      setMessage({ kind: 'error', text: 'Please check the price, deposit and number of diners: they must be numbers.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = isNew
        ? await send('/api/manager/events', 'POST', event)
        : await send(`/api/manager/events/${id}`, 'PUT', event)
      setDirty(false)
      if (isNew) {
        onCreated(res.id)
      } else {
        await remote.mutate()
        setMessage({ kind: 'ok', text: 'Saved.' })
      }
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(to: ManagerStatus) {
    setBusy(true)
    setMessage(null)
    try {
      await send(`/api/manager/events/${id}`, 'PATCH', { status: to })
      await remote.mutate()
      setMessage({ kind: 'ok', text: `Status changed to “${STATUS_LABEL[to]}”.` })
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const orders = facts?.orderCount ?? 0
    if (
      !window.confirm(
        `Delete the test evening “${form!.title}”` +
          (orders ? ` and its ${orders} order${orders === 1 ? '' : 's'}` : '') +
          '? This can’t be undone.',
      )
    )
      return
    setBusy(true)
    try {
      await send(`/api/manager/events/${id}`, 'DELETE')
      onBack()
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
      setBusy(false)
    }
  }

  function duplicate() {
    if (!form) return
    const copy = fromForm(form) ?? fromForm({ ...form, price: '0', deposit: '0', capacity: '40' })!
    onDuplicate({
      ...copy,
      id: null,
      slug: '',
      date: '',
      cutoffAt: '',
      status: 'draft',
      isTest: false,
      courses: copy.courses.map((c) => ({
        ...c,
        id: null,
        options: c.options.map((o) => ({ ...o, id: null })),
      })),
      collectionPoints: copy.collectionPoints.map((p) => ({ ...p, id: null })),
    })
  }

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <button type="button" onClick={leave} className={buttonStyles('text')}>
          ‹ All evenings
        </button>
        <h2 className="text-3xl text-charcoal">
          {isNew ? (start?.title ? 'Copy of an evening' : 'New evening') : form.title || 'Evening'}
          {form.isTest ? <TestTag /> : null}
        </h2>
        {isNew ? (
          <p className="text-sm leading-relaxed text-stone">
            {start?.title
              ? 'Everything has been copied except the date, cut-off and web address. Nothing is saved until you press Save.'
              : 'Fill in the details below and press Save. New evenings start as drafts, hidden from the website.'}
          </p>
        ) : facts ? (
          <p className="text-sm text-stone">
            <StatusLabel status={form.status} /> · {facts.placesTaken} of {form.capacity} places taken ·{' '}
            {facts.orderCount} order{facts.orderCount === 1 ? '' : 's'}
            {form.status !== 'draft' ? (
              <>
                {' · '}
                <a
                  href={`/dine-at-home/${form.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-deep underline underline-offset-4"
                >
                  View on the website
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Status */}
      {!isNew ? (
        <Panel title="Status">
          <p className="text-sm text-charcoal">
            Now: <strong className="font-normal text-gold-deep">{STATUS_LABEL[form.status]}</strong>
          </p>
          {dirty ? (
            <p className="text-sm text-stone">Save your changes first to change the status.</p>
          ) : null}
          <ul className="space-y-3">
            {STATUS_ACTIONS.filter((a) => a.to !== form.status).map((a) => (
              <li key={a.to} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                  type="button"
                  disabled={busy || dirty}
                  onClick={() => changeStatus(a.to)}
                  className={buttonStyles('outline', 'w-48 px-3 py-2')}
                >
                  {a.label}
                </button>
                <span className="flex-1 text-sm text-stone">{a.help}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* Details */}
      <Panel title="Details">
        <Field label="Title" hint="As shown on the website, e.g. Inspired by India.">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) =>
              update({
                title: e.target.value,
                ...(slugTouched ? {} : { slug: slugify(e.target.value) }),
              })
            }
          />
        </Field>
        <Field label="Theme" hint="Optional short theme line. Leave empty to use the title.">
          <input className={inputClass} value={form.theme} onChange={(e) => update({ theme: e.target.value })} />
        </Field>
        <Field
          label="Web address"
          hint={`The end of the evening’s page address: chefej.popol.tech/dine-at-home/${form.slug || '…'}`}
        >
          <input
            className={inputClass}
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true)
              update({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })
            }}
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Date of the evening">
            <input
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) =>
                update({
                  date: e.target.value,
                  ...(!form.cutoffAt && e.target.value ? { cutoffAt: defaultCutoff(e.target.value) } : {}),
                })
              }
            />
          </Field>
          <Field label="Last orders" hint="Day and time (French time).">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.cutoffAt}
              onChange={(e) => update({ cutoffAt: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Price per person (€)">
            <input inputMode="decimal" className={inputClass} value={form.price} onChange={(e) => update({ price: e.target.value })} />
          </Field>
          <Field label="Deposit per person (€)">
            <input inputMode="decimal" className={inputClass} value={form.deposit} onChange={(e) => update({ deposit: e.target.value })} />
          </Field>
          <Field label="Diners (capacity)">
            <input inputMode="numeric" className={inputClass} value={form.capacity} onChange={(e) => update({ capacity: e.target.value })} />
          </Field>
        </div>
        <Field label="Introduction" hint="A few lines shown under the title on the evening’s page.">
          <textarea rows={3} className={inputClass} value={form.intro} onChange={(e) => update({ intro: e.target.value })} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImagePicker label="Main photo" value={form.heroImage} onChange={(v) => update({ heroImage: v })} />
          <ImagePicker label="Menu picture" value={form.menuImage} onChange={(v) => update({ menuImage: v })} />
        </div>
        {isNew ? (
          <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-charcoal">
            <input
              type="checkbox"
              className="tick mt-0.5"
              checked={form.isTest}
              onChange={(e) => update({ isTest: e.target.checked })}
            />
            <span>
              This is a test evening (for trying things out). Test evenings can be deleted with all their
              orders; real ones can’t. This can’t be changed later.
            </span>
          </label>
        ) : null}
      </Panel>

      {/* Menu */}
      <Panel title="Menu">
        {form.courses.length === 0 ? <p className="text-sm text-stone">No courses yet.</p> : null}
        <ol className="space-y-6">
          {form.courses.map((c, i) => (
            <li key={i} className="space-y-4 border border-border bg-background p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="caps flex-1 text-gold-deep">Course {i + 1}</span>
                <SmallButton disabled={i === 0} onClick={() => setCourses(move(form.courses, i, -1))} label="Move up">↑</SmallButton>
                <SmallButton
                  disabled={i === form.courses.length - 1}
                  onClick={() => setCourses(move(form.courses, i, 1))}
                  label="Move down"
                >
                  ↓
                </SmallButton>
                <SmallButton
                  disabled={c.options.some((o) => o.id && usedOptions.has(o.id))}
                  title={c.options.some((o) => o.id && usedOptions.has(o.id)) ? 'Already ordered: can’t be removed' : undefined}
                  onClick={() => setCourses(form.courses.filter((_, j) => j !== i))}
                  label="Remove course"
                >
                  Remove
                </SmallButton>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Course name" hint="e.g. Starter, Main, Dessert.">
                  <input className={inputClass} value={c.name} onChange={(e) => setCourse(i, { name: e.target.value })} />
                </Field>
                <Field label="Type">
                  <select
                    className={inputClass}
                    value={c.kind}
                    onChange={(e) => {
                      const kind = e.target.value as EditableCourse['kind']
                      const options = [...c.options]
                      while (options.length < (kind === 'choice' ? 2 : 1)) options.push(blankOption())
                      setCourse(i, { kind, options })
                    }}
                  >
                    <option value="fixed">Same for everyone</option>
                    <option value="choice">Diners choose a dish</option>
                  </select>
                </Field>
              </div>
              <Field label="Description line" hint="Shown in italics. Separate components with · (e.g. bombay potato · makhani gravy).">
                <input
                  className={inputClass}
                  value={c.description}
                  onChange={(e) => setCourse(i, { description: e.target.value })}
                />
              </Field>

              <div className="space-y-3">
                <p className="caps text-stone">{c.kind === 'choice' ? 'Dishes to choose from' : 'Dish'}</p>
                {c.options.map((o, oi) => {
                  const used = Boolean(o.id && usedOptions.has(o.id))
                  const setOption = (patch: Partial<typeof o>) =>
                    setCourse(i, { options: c.options.map((x, k) => (k === oi ? { ...x, ...patch } : x)) })
                  return (
                    <div key={oi} className="flex flex-wrap items-center gap-2 border-b border-border pb-3 sm:border-0 sm:pb-0">
                      <input
                        aria-label="Dish name"
                        className={cn(inputClass, 'min-w-0 basis-full sm:flex-1 sm:basis-56')}
                        value={o.name}
                        onChange={(e) => setOption({ name: e.target.value })}
                      />
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
                        <input
                          type="checkbox"
                          className="tick"
                          checked={o.vegetarian}
                          onChange={(e) => setOption({ vegetarian: e.target.checked })}
                        />
                        (v) vegetarian
                      </label>
                      <span className="flex-1" />
                      {c.kind === 'choice' ? (
                        <>
                          <SmallButton disabled={oi === 0} onClick={() => setCourse(i, { options: move(c.options, oi, -1) })} label="Move dish up">↑</SmallButton>
                          <SmallButton
                            disabled={oi === c.options.length - 1}
                            onClick={() => setCourse(i, { options: move(c.options, oi, 1) })}
                            label="Move dish down"
                          >
                            ↓
                          </SmallButton>
                          <SmallButton
                            disabled={used || c.options.length <= 2}
                            title={used ? 'Already ordered: can’t be removed' : undefined}
                            onClick={() => setCourse(i, { options: c.options.filter((_, k) => k !== oi) })}
                            label="Remove dish"
                          >
                            ✕
                          </SmallButton>
                        </>
                      ) : null}
                    </div>
                  )
                })}
                {c.kind === 'choice' ? (
                  <button
                    type="button"
                    className={buttonStyles('text', 'text-[0.65rem]')}
                    onClick={() => setCourse(i, { options: [...c.options, blankOption()] })}
                  >
                    + Add a dish
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={buttonStyles('outline', 'px-5 py-2')}
          onClick={() =>
            setCourses([...form.courses, { id: null, name: '', kind: 'fixed', description: '', options: [blankOption()] }])
          }
        >
          + Add a course
        </button>
      </Panel>

      {/* Collection points */}
      <Panel title="Collection points">
        <p className="text-sm text-stone">
          Listed by time once saved. Addresses are only given to customers who order, never shown on the website.
        </p>
        {form.collectionPoints.map((p, i) => {
          const used = Boolean(p.id && usedPoints.has(p.id))
          const setPoint = (patch: Partial<typeof p>) =>
            update({ collectionPoints: form.collectionPoints.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
          return (
            <div key={i} className="space-y-3 border border-border bg-background p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <Field label="Place">
                  <input className={inputClass} value={p.place} onChange={(e) => setPoint({ place: e.target.value })} />
                </Field>
                <Field label="Time">
                  <input type="time" className={inputClass} value={p.time} onChange={(e) => setPoint({ time: e.target.value })} />
                </Field>
                <SmallButton
                  disabled={used}
                  title={used ? 'Customers are collecting here: can’t be removed' : undefined}
                  onClick={() => update({ collectionPoints: form.collectionPoints.filter((_, k) => k !== i) })}
                  label="Remove collection point"
                >
                  Remove
                </SmallButton>
              </div>
              <Field label="Exact address">
                <input className={inputClass} value={p.address} onChange={(e) => setPoint({ address: e.target.value })} />
              </Field>
            </div>
          )
        })}
        <button
          type="button"
          className={buttonStyles('outline', 'px-5 py-2')}
          onClick={() =>
            update({ collectionPoints: [...form.collectionPoints, { id: null, place: '', time: '', address: '' }] })
          }
        >
          + Add a collection point
        </button>
      </Panel>

      {/* Other actions */}
      {!isNew ? (
        <Panel title="More">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={buttonStyles('outline', 'px-5 py-2')} onClick={duplicate} disabled={busy}>
              Duplicate this evening
            </button>
            {form.isTest ? (
              <button
                type="button"
                className={buttonStyles('outline', 'border-destructive/60 px-5 py-2 text-destructive hover:border-destructive hover:text-destructive')}
                onClick={remove}
                disabled={busy}
              >
                Delete test evening
              </button>
            ) : null}
          </div>
          {!form.isTest ? (
            <p className="text-sm text-stone">Real evenings can’t be deleted. Use “Back to draft” to hide one.</p>
          ) : null}
        </Panel>
      ) : null}

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className={buttonStyles('solid', 'px-10')} onClick={save} disabled={busy || (!dirty && !isNew)}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className={buttonStyles('text')} onClick={leave}>
            {dirty ? 'Cancel' : 'Back'}
          </button>
          {message ? (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={cn('flex-1 text-sm', message.kind === 'error' ? 'text-destructive' : 'text-gold-deep')}
            >
              {message.text}
            </p>
          ) : dirty ? (
            <p className="flex-1 text-sm text-stone">Unsaved changes</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ---------- Small pieces ---------- */

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-6 border border-border bg-ivory px-4 py-6 sm:px-6">
      <h3 className="caps text-gold-deep">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm text-charcoal">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-relaxed text-stone">{hint}</span> : null}
    </label>
  )
}

function SmallButton({
  children,
  onClick,
  disabled,
  label,
  title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
  title?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className="h-9 min-w-9 border border-stone/40 px-2 text-sm text-charcoal transition-colors hover:border-gold hover:text-gold-deep disabled:opacity-30 disabled:hover:border-stone/40 disabled:hover:text-charcoal"
    >
      {children}
    </button>
  )
}

function ImagePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {IMAGES.map((i) => (
          <option key={i.path} value={i.path}>
            {i.label}
          </option>
        ))}
      </select>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 h-28 w-full border border-border object-cover" />
      ) : null}
    </Field>
  )
}

function StatusLabel({ status }: { status: ManagerStatus }) {
  return <span className={status === 'open' ? 'text-gold-deep' : undefined}>{STATUS_LABEL[status]}</span>
}

function TestTag() {
  return <span className="caps ml-3 align-middle text-[0.6rem] text-stone">Test</span>
}

/* ---------- Helpers ---------- */

function blankOption() {
  return { id: null, name: '', vegetarian: false, description: '' }
}

function blankEvent(): EditableEvent {
  return {
    id: null, slug: '', title: '', theme: '', date: '', intro: '', heroImage: '', menuImage: '',
    priceCents: 0, depositCents: 0, capacity: 40, cutoffAt: '', status: 'draft', isTest: false,
    courses: [], collectionPoints: [],
  }
}

function toForm(e: EditableEvent): Form {
  return {
    ...e,
    price: e.priceCents ? euros(e.priceCents) : '',
    deposit: e.priceCents || e.depositCents ? euros(e.depositCents) : '',
    capacity: String(e.capacity),
  }
}

/** Back from the form to an event; null if a number doesn't make sense. */
function fromForm(f: Form): EditableEvent | null {
  const price = cents(f.price)
  const deposit = f.deposit.trim() === '' ? 0 : cents(f.deposit)
  const capacity = Number(f.capacity)
  if (price === null || deposit === null || !Number.isInteger(capacity)) return null
  const { price: _p, deposit: _d, capacity: _c, ...rest } = f
  return { ...rest, priceCents: price, depositCents: deposit, capacity }
}

function euros(c: number) {
  return c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)
}

/** "42", "42,5", "42.50" or "€42" → cents. */
function cents(s: string): number | null {
  const t = s.replace(/[€\s]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Two days before the evening, just before midnight. */
function defaultCutoff(date: string) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 2)
  return d.toISOString().slice(0, 10) + 'T23:59'
}

function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const next = [...list]
  ;[next[i], next[i + by]] = [next[i + by], next[i]]
  return next
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}
