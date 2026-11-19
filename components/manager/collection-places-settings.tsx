'use client'

import { useState } from 'react'
import { useLoadedForm } from '@/components/manager/use-loaded-form'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { CollectionPlace } from '@/lib/event-editing'

/*
 * Console → Settings → Collection places (issue #35): the master list.
 * Ticked places go into every new evening at their usual time. Each evening
 * keeps its own copy, so changing or removing a place here doesn't touch
 * evenings already created.
 */

const blank = (): CollectionPlace => ({ id: null, place: '', address: '', time: '', inNewEvents: true })

export function CollectionPlacesSettings() {
  const { data, mutate } = useSWR<{ places?: CollectionPlace[]; error?: string }>(
    '/api/manager/collection-places',
    fetcher,
  )
  const [dirty, setDirty] = useState(false)
  // Filled from the saved list, except while there are unsaved changes.
  const [places, setPlaces] = useLoadedForm(data?.places, (p) => p, dirty)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  if (data?.error) return <p className="text-sm text-destructive">The collection places couldn’t be loaded.</p>
  if (!places) return <p className="text-sm text-stone">Loading…</p>

  const change = (next: CollectionPlace[]) => {
    setPlaces(next)
    setDirty(true)
    setState('idle')
    setError('')
  }
  const setPlace = (i: number, patch: Partial<CollectionPlace>) =>
    change(places.map((p, k) => (k === i ? { ...p, ...patch } : p)))

  async function save() {
    setState('saving')
    setError('')
    try {
      const res = await send('/api/manager/collection-places', 'PUT', { places })
      setDirty(false)
      setPlaces(res.places)
      await mutate({ places: res.places }, { revalidate: false })
      setState('saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setState('idle')
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="caps text-sm text-charcoal">Collection places</h2>
      <p className="text-sm text-stone">
        Every place customers can collect from. Ticked places are put into each new evening at their usual
        time; you can still change the time or remove a place for one evening. Changes here don’t alter
        evenings already created. Addresses are only given to customers in their confirmation and reminder
        emails, never shown on the website.
      </p>

      {places.length === 0 ? (
        <p className="border border-border bg-ivory px-4 py-6 text-center text-sm text-stone">No collection places yet.</p>
      ) : null}

      {places.map((p, i) => (
        <div key={p.id ?? `new-${i}`} className="space-y-3 border border-border bg-background p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <Field label="Place">
              <input className={inputClass} value={p.place} onChange={(e) => setPlace(i, { place: e.target.value })} />
            </Field>
            <Field label="Usual time">
              <input type="time" className={inputClass} value={p.time} onChange={(e) => setPlace(i, { time: e.target.value })} />
            </Field>
            <button
              type="button"
              className={buttonStyles('outline', 'px-4 py-2 text-sm')}
              onClick={() => {
                if (p.id && !window.confirm(`Remove ${p.place || 'this place'} from the list? Evenings already created keep it.`)) return
                change(places.filter((_, k) => k !== i))
              }}
            >
              Remove
            </button>
          </div>
          <Field label="Exact address">
            <input className={inputClass} value={p.address} onChange={(e) => setPlace(i, { address: e.target.value })} />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-charcoal">
            <input
              type="checkbox"
              className="tick"
              checked={p.inNewEvents}
              onChange={(e) => setPlace(i, { inNewEvents: e.target.checked })}
            />
            Included in new events
          </label>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={buttonStyles('outline', 'px-5 py-2')} onClick={() => change([...places, blank()])}>
          + Add a collection place
        </button>
        <button
          type="button"
          className={buttonStyles('solid', 'px-10')}
          disabled={!dirty || state === 'saving'}
          onClick={save}
        >
          {state === 'saving' ? 'Saving…' : 'Save collection places'}
        </button>
        {state === 'saved' && !dirty ? <span className="text-sm text-stone">Saved.</span> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </section>
  )
}

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm text-charcoal">{label}</span>
      {children}
    </label>
  )
}
