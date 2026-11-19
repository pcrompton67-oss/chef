'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useLoadedForm } from '@/components/manager/use-loaded-form'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import { SITE_URL } from '@/lib/site'
import {
  type CollectionPlace,
  type EditableCourse,
  type EditableOption,
  type EditableEvent,
  type EditablePoint,
  type EventFacts,
  type ManagerStatus,
} from '@/lib/event-editing'
import type { EventListItem } from '@/lib/manager-events'
import type { MenuCardDraft } from '@/lib/menu-card'
import { MenuCardStart, type CardPhotos } from '@/components/manager/menu-card-start'
import { ImagePicker, PrintedMenuPicker } from '@/components/manager/image-picker'
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

// How a new, unsaved evening was started (changes the editor's opening words).
type NewSource = 'blank' | 'copy' | 'card'

type View =
  | { kind: 'list' }
  | { kind: 'card' }
  | { kind: 'edit'; id: string }
  | { kind: 'new'; start: EditableEvent; n: number; source: NewSource; notes?: string[]; pointsFromList?: boolean }

export function EventsTab() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const list = useSWR<{ events?: EventListItem[]; error?: string }>('/api/manager/events', fetcher)
  // The master list of collection places (issue #35). Ticked ones start every new evening.
  const placesRes = useSWR<{ places?: CollectionPlace[] }>('/api/manager/collection-places', fetcher)
  const places = placesRes.data?.places ?? []
  const defaults = places.filter((p) => p.inNewEvents).map(pointFromPlace)
  // A new evening gets the ticked places; with none ticked it keeps what it had (empty, or copied).
  const withDefaults = (e: EditableEvent) =>
    defaults.length ? { ...e, collectionPoints: defaults } : e

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
        onNew={() =>
          setView({
            kind: 'new',
            start: withDefaults(blankEvent()),
            n: Date.now(),
            source: 'blank',
            pointsFromList: defaults.length > 0,
          })
        }
        onCard={() => setView({ kind: 'card' })}
      />
    )
  }
  if (view.kind === 'card') {
    return (
      <MenuCardStart
        events={list.data?.events}
        onCancel={back}
        onRead={(draft, base, photos) => {
          const { start, notes } = eventFromCard(draft, base, defaults, photos)
          setView({ kind: 'new', start, n: Date.now(), source: 'card', notes })
          window.scrollTo(0, 0)
        }}
      />
    )
  }
  return (
    <EventEditor
      key={view.kind === 'edit' ? view.id : `new-${view.n}`}
      id={view.kind === 'edit' ? view.id : null}
      start={view.kind === 'new' ? view.start : null}
      source={view.kind === 'new' ? view.source : null}
      notes={view.kind === 'new' ? view.notes : undefined}
      pointsFromList={view.kind === 'new' && Boolean(view.pointsFromList)}
      places={places}
      onBack={back}
      onCreated={(id) => {
        list.mutate()
        setView({ kind: 'edit', id })
      }}
      onDuplicate={(copy) => {
        setView({
          kind: 'new',
          start: withDefaults(copy),
          n: Date.now(),
          source: 'copy',
          pointsFromList: defaults.length > 0,
        })
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
  onCard,
}: {
  events?: EventListItem[]
  error?: unknown
  onOpen: (id: string) => void
  onNew: () => void
  onCard: () => void
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl text-charcoal">Evenings</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonStyles('outline')} onClick={onCard}>
            New evening from menu card
          </button>
          <button type="button" className={buttonStyles('solid')} onClick={onNew}>
            New evening
          </button>
        </div>
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
  source,
  notes,
  pointsFromList,
  places,
  onBack,
  onCreated,
  onDuplicate,
}: {
  id: string | null
  start: EditableEvent | null
  source: NewSource | null
  notes?: string[]
  pointsFromList: boolean
  places: CollectionPlace[]
  onBack: () => void
  onCreated: (id: string) => void
  onDuplicate: (copy: EditableEvent) => void
}) {
  const remote = useSWR<{ event?: EditableEvent; facts?: EventFacts; error?: string }>(
    id ? `/api/manager/events/${id}` : null,
    fetcher,
  )
  const [slugTouched, setSlugTouched] = useState(Boolean(id))
  const [dirty, setDirty] = useState(false)
  // Filled once the saved evening has loaded (and after each save), except
  // while there are unsaved changes. A new evening starts from `start`.
  const [form, setForm] = useLoadedForm(remote.data?.event, toForm, dirty, start ? toForm(start) : null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

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
  // Test evenings can always be deleted; real ones only while still a draft with no orders.
  // (The server makes the final check, which also counts cancelled and expired orders.)
  const canDelete = !!form && (form.isTest || (form.status === 'draft' && (facts?.orderCount ?? 0) === 0))
  const usedOptions = new Set(facts?.usedOptionIds ?? [])
  const usedPoints = new Set(facts?.usedPointIds ?? [])
  // Places on the master list that this evening doesn't have yet (matched by name).
  const here = new Set(form.collectionPoints.map((p) => p.place.trim().toLowerCase()))
  const unusedPlaces = places.filter((p) => !here.has(p.place.trim().toLowerCase()))

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
        `Delete the ${form!.isTest ? 'test ' : ''}evening “${form!.title}”` +
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
    onDuplicate(asNewCopy(copy))
  }

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <button type="button" onClick={leave} className={buttonStyles('text')}>
          ‹ All evenings
        </button>
        <h2 className="text-3xl text-charcoal">
          {isNew
            ? source === 'copy'
              ? 'Copy of an evening'
              : source === 'card'
                ? 'New evening from menu card'
                : 'New evening'
            : form.title || 'Evening'}
          {form.isTest ? <TestTag /> : null}
        </h2>
        {isNew ? (
          <p className="text-sm leading-relaxed text-stone">
            {source === 'copy'
              ? 'Everything has been copied except the date, cut-off and web address' +
                (pointsFromList ? ', and the collection points are the places ticked in Settings' : '') +
                '. Nothing is saved until you press Save.'
              : source === 'card'
                ? 'Filled in from your menu card. Please check everything against the card, add anything missing, then press Save. It starts as a draft, hidden from the website.'
                : 'Fill in the details below and press Save. New evenings start as drafts, hidden from the website.' +
                  (pointsFromList ? ' The collection points are the places ticked in Settings.' : '')}
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

      {/* What to check after reading a menu card */}
      {isNew && notes?.length ? (
        <section className="space-y-3 border border-gold bg-ivory px-4 py-5 sm:px-6">
          <h3 className="caps text-gold-deep">Please check</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-charcoal">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

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
        <Field label="Title in French" hint={FR_HINT}>
          <input lang="fr" className={inputClass} value={form.titleFr} onChange={(e) => update({ titleFr: e.target.value })} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Theme" hint="Optional short theme line. Leave empty to use the title.">
            <input className={inputClass} value={form.theme} onChange={(e) => update({ theme: e.target.value })} />
          </Field>
          <Field label="Theme in French" hint="Optional. Leave empty to use the French title.">
            <input lang="fr" className={inputClass} value={form.themeFr} onChange={(e) => update({ themeFr: e.target.value })} />
          </Field>
        </div>
        <Field
          label="Web address"
          hint={`The end of the evening’s page address: ${SITE_URL.replace(/^https?:\/\//, '')}/dine-at-home/${form.slug || '…'}`}
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
        <Field label="Introduction in French" hint={FR_HINT}>
          <textarea lang="fr" rows={3} className={inputClass} value={form.introFr} onChange={(e) => update({ introFr: e.target.value })} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImagePicker
            label="Main photo"
            hint="At the top of the evening’s page, and on its card on the home page."
            noneLabel="The usual photo"
            value={form.heroImage}
            onChange={(v) => update({ heroImage: v })}
          />
          <ImagePicker
            label="Second photo"
            hint="Further down the evening’s page, beside the price and collection times."
            noneLabel="The usual photo"
            value={form.secondImage}
            onChange={(v) => update({ secondImage: v })}
          />
          <PrintedMenuPicker
            label="Printed menu (English)"
            hint="Linked as “View the printed menu” on the English site. A PDF or a photo."
            language="en"
            value={form.menuImage}
            onChange={(v) => update({ menuImage: v })}
          />
          <PrintedMenuPicker
            label="Printed menu (French)"
            hint="Linked on the French site. If only one menu is given, both sites use it."
            language="fr"
            value={form.menuImageFr}
            onChange={(v) => update({ menuImageFr: v })}
          />
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
              orders; real ones only while still a draft with no orders. This can’t be changed later.
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
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Course name" hint="e.g. Starter, Main, Dessert.">
                  <input className={inputClass} value={c.name} onChange={(e) => setCourse(i, { name: e.target.value })} />
                </Field>
                <Field label="Course name in French" hint="e.g. Entrée, Plat, Dessert.">
                  <input lang="fr" className={inputClass} value={c.nameFr} onChange={(e) => setCourse(i, { nameFr: e.target.value })} />
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
              <Field label="Description line in French" hint={FR_HINT}>
                <input
                  lang="fr"
                  className={inputClass}
                  value={c.descriptionFr}
                  onChange={(e) => setCourse(i, { descriptionFr: e.target.value })}
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
                      <input
                        aria-label="Dish name in French"
                        lang="fr"
                        placeholder="Dish name in French (optional)"
                        className={cn(inputClass, 'order-last min-w-0 basis-full')}
                        value={o.nameFr}
                        onChange={(e) => setOption({ nameFr: e.target.value })}
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
            setCourses([...form.courses, blankCourse()])
          }
        >
          + Add a course
        </button>
      </Panel>

      {/* Collection points */}
      <Panel title="Collection points">
        <p className="text-sm text-stone">
          Listed by time once saved. Addresses are only given to customers who order, never shown on the website.
          The full list of places is in Settings → Collection places.
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
        <div className="flex flex-wrap items-center gap-4">
          {unusedPlaces.length ? (
            <select
              className={inputClass + ' w-auto'}
              value=""
              aria-label="Add a place from the list"
              onChange={(e) => {
                const p = unusedPlaces.find((x) => x.id === e.target.value)
                if (p) update({ collectionPoints: [...form.collectionPoints, pointFromPlace(p)] })
              }}
            >
              <option value="">+ Add a place from the list…</option>
              {unusedPlaces.map((p) => (
                <option key={p.id} value={p.id!}>
                  {p.place} ({p.time})
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className={buttonStyles('outline', 'px-5 py-2')}
            onClick={() =>
              update({ collectionPoints: [...form.collectionPoints, { id: null, place: '', time: '', address: '' }] })
            }
          >
            + Add a one-off place
          </button>
        </div>
      </Panel>

      {/* Other actions */}
      {!isNew ? (
        <Panel title="More">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={buttonStyles('outline', 'px-5 py-2')} onClick={duplicate} disabled={busy}>
              Duplicate this evening
            </button>
            {canDelete ? (
              <button
                type="button"
                className={buttonStyles('outline', 'border-destructive/60 px-5 py-2 text-destructive hover:border-destructive hover:text-destructive')}
                onClick={remove}
                disabled={busy}
              >
                {form.isTest ? 'Delete test evening' : 'Delete this draft'}
              </button>
            ) : null}
          </div>
          {!canDelete ? (
            <p className="text-sm text-stone">
              {form.status === 'draft'
                ? 'This evening has orders, so it can’t be deleted.'
                : 'Real evenings can only be deleted while they’re a draft with no orders. Use “Back to draft” to hide one.'}
            </p>
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

function StatusLabel({ status }: { status: ManagerStatus }) {
  return <span className={status === 'open' ? 'text-gold-deep' : undefined}>{STATUS_LABEL[status]}</span>
}

function TestTag() {
  return <span className="caps ml-3 align-middle text-[0.6rem] text-stone">Test</span>
}

/* ---------- Helpers ---------- */

/** Shown under the French boxes (issue #12). */
const FR_HINT = 'For the French site. Leave empty to show the English there.'

/** A place from the master list, ready to add to an evening at its usual time. */
function pointFromPlace(p: CollectionPlace): EditablePoint {
  return { id: null, place: p.place, time: p.time, address: p.address }
}

function blankOption(): EditableOption {
  return { id: null, name: '', nameFr: '', vegetarian: false, description: '' }
}

function blankCourse(): EditableCourse {
  return { id: null, name: '', nameFr: '', kind: 'fixed', description: '', descriptionFr: '', options: [blankOption()] }
}

function blankEvent(): EditableEvent {
  return {
    id: null, slug: '', title: '', theme: '', date: '', intro: '', heroImage: '', secondImage: '', menuImage: '', menuImageFr: '',
    titleFr: '', themeFr: '', introFr: '',
    priceCents: 0, depositCents: 0, capacity: 40, cutoffAt: '', status: 'draft', isTest: false,
    courses: [], collectionPoints: [],
  }
}

/** A saved evening turned into the start of a new, unsaved one (no date, cut-off, address or saved ids). */
function asNewCopy(e: EditableEvent): EditableEvent {
  return {
    ...e,
    id: null,
    slug: '',
    date: '',
    cutoffAt: '',
    status: 'draft',
    isTest: false,
    courses: e.courses.map((c) => ({ ...c, id: null, options: c.options.map((o) => ({ ...o, id: null })) })),
    collectionPoints: e.collectionPoints.map((p) => ({ ...p, id: null })),
  }
}

/**
 * A new evening from a menu card read by Claude (issue #23): the menu, title,
 * date, price and intro from the card; everything else from the chosen
 * previous evening, or empty.
 */
function eventFromCard(
  card: MenuCardDraft,
  base: EditableEvent | null,
  defaults: EditablePoint[],
  photos: CardPhotos,
): { start: EditableEvent; notes: string[] } {
  const copied = base ? asNewCopy(base) : blankEvent()
  const from = defaults.length ? { ...copied, collectionPoints: defaults } : copied
  const notes = [...card.notes]
  if (!card.title) notes.push('No title was found on the card: please add one.')
  if (!card.date) notes.push('No date was found on the card: please add the date of the evening.')
  if (card.priceCents === null)
    notes.push(base ? 'No price on the card: the price was copied from the earlier evening.' : 'No price on the card: please add one.')
  const points = defaults.length
    ? 'The collection points are the places ticked in Settings: please check the times.'
    : ''
  notes.push(
    base
      ? defaults.length
        ? `${photos.heroImage ? 'The deposit and number of diners' : 'The deposit, number of diners and main photo'} were copied from “${base.title}”. Please check them. ${points}`
        : `The deposit, number of diners, ${photos.heroImage ? '' : 'main photo '}and collection points were copied from “${base.title}”. Please check them.`
      : defaults.length
        ? `The deposit and number of diners aren’t on the card: please fill them in. ${points}`
        : 'The deposit, number of diners and collection points aren’t on the card: please fill them in.',
  )
  if (base?.isTest && !defaults.length)
    notes.push('That was a test evening: make sure the collection points have real addresses before opening for orders.')
  notes.push('Please check every dish, (v) mark and description line against the card.')
  if (card.menuNotKept)
    notes.push(
      `Your card couldn’t be kept as the printed menu, so please upload it under “Printed menu”. Reason: ${card.menuNotKept}`,
    )
  if (card.menuImage || card.menuImageFr)
    notes.push(
      card.menuImage && card.menuImageFr
        ? 'Your two cards are set as the printed menus (English and French).'
        : 'Your card is set as the printed menu for both the English and French sites.',
    )
  return {
    start: {
      ...from,
      title: card.title,
      slug: slugify(card.title),
      theme: '',
      intro: card.intro || from.intro,
      titleFr: card.titleFr,
      themeFr: '',
      introFr: card.introFr || (card.intro ? '' : from.introFr),
      date: card.date,
      cutoffAt: card.date ? defaultCutoff(card.date) : '',
      priceCents: card.priceCents ?? from.priceCents,
      // Photos chosen on the menu-card page (issue #39) win over the copied ones.
      heroImage: photos.heroImage || from.heroImage,
      secondImage: photos.secondImage || from.secondImage,
      // The card(s) just read become the printed menus; the old evening's would be wrong for this one.
      menuImage: card.menuImage ?? '',
      menuImageFr: card.menuImageFr ?? '',
      courses: card.courses,
    },
    notes,
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
