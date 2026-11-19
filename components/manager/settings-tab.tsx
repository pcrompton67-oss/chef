'use client'

import { useState, type ReactNode } from 'react'
import { useLoadedForm } from '@/components/manager/use-loaded-form'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { BusinessSettings } from '@/lib/settings'
import { MAX_CUTOFF_DAYS, cutoffRuleOk, describeCutoff } from '@/lib/event-editing'
import { CollectionPlacesSettings } from '@/components/manager/collection-places-settings'
import { HomePhotoSettings } from '@/components/manager/home-photo-settings'

/*
 * Console → Settings (issue #6): the bank details customers pay the deposit
 * to (shown on the thank-you page and in the "request received" email), and
 * how many days they have to pay before the order is flagged as overdue,
 * and when a new evening's orders close (issue #43).
 * Also the master list of collection places (issue #35) and the home page
 * photo (issue #37), each saved separately.
 * More business settings can be added here later.
 */

type Form = {
  accountName: string
  iban: string
  bic: string
  holdDays: string
  cutoffDaysBefore: string
  cutoffTime: string
}

const toForm = (s: BusinessSettings): Form => ({
  accountName: s.accountName,
  iban: s.iban,
  bic: s.bic,
  holdDays: String(s.holdDays),
  cutoffDaysBefore: String(s.cutoffDaysBefore),
  cutoffTime: s.cutoffTime,
})

export function SettingsTab() {
  const { data, mutate } = useSWR<{ settings: BusinessSettings }>('/api/manager/settings', fetcher)
  // Filled from the saved settings (again after each save).
  const [form, setForm] = useLoadedForm(data?.settings, toForm)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  if (!data?.settings || !form) return <p className="text-sm text-stone">Loading…</p>

  const saved = toForm(data.settings)
  const changed = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k])
  const days = Number(form.holdDays)
  const daysOk = Number.isInteger(days) && days >= 1 && days <= 30
  const cutoff = { cutoffDaysBefore: Number(form.cutoffDaysBefore), cutoffTime: form.cutoffTime }
  const cutoffOk = form.cutoffDaysBefore.trim() !== '' && cutoffRuleOk(cutoff)

  function set(k: keyof Form, v: string) {
    setForm({ ...form!, [k]: v })
    setState('idle')
  }

  async function save() {
    setState('saving')
    setError('')
    try {
      await send('/api/manager/settings', 'PUT', { ...form, holdDays: days, ...cutoff })
      await mutate()
      setState('saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setState('idle')
    }
  }

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <Heading>Bank details</Heading>
        <p className="text-sm text-stone">
          Customers who order on the website pay the deposit by bank transfer to this account. The details
          are shown on the thank-you page and in the “Request received” email. Until they are filled in,
          customers are told you’ll send them shortly.
        </p>
        <Field label="Account name">
          <input className={inputClass} value={form.accountName} onChange={(e) => set('accountName', e.target.value)} />
        </Field>
        <Field label="IBAN">
          <input className={inputClass} value={form.iban} onChange={(e) => set('iban', e.target.value)} />
        </Field>
        <Field label="BIC (optional)">
          <input className={inputClass} value={form.bic} onChange={(e) => set('bic', e.target.value)} />
        </Field>
      </section>

      <section className="space-y-4">
        <Heading>Time to pay the deposit</Heading>
        <p className="text-sm text-stone">
          Customers are asked to pay within this many days. After that the order shows as “Deposit overdue”
          in Orders. Its places stay held until you confirm the deposit or release them yourself.
        </p>
        <Field label="Days">
          <input
            className={inputClass + ' max-w-24'}
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={form.holdDays}
            onChange={(e) => set('holdDays', e.target.value)}
          />
        </Field>
        {!daysOk ? <p className="text-sm text-destructive">Please enter a number of days from 1 to 30.</p> : null}
      </section>

      <section className="space-y-4">
        <Heading>Last orders</Heading>
        <p className="text-sm text-stone">
          When a new evening’s orders close, worked out from its date (French time). You can still change it
          for any one evening. Evenings already made keep their own.
        </p>
        <div className="flex flex-wrap gap-6">
          <Field label="Days before the evening">
            <input
              className={inputClass + ' max-w-24'}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_CUTOFF_DAYS}
              value={form.cutoffDaysBefore}
              onChange={(e) => set('cutoffDaysBefore', e.target.value)}
            />
          </Field>
          <Field label="At">
            <input
              className={inputClass + ' max-w-32'}
              type="time"
              value={form.cutoffTime}
              onChange={(e) => set('cutoffTime', e.target.value)}
            />
          </Field>
        </div>
        {cutoffOk ? (
          <p className="text-sm text-stone">Orders close {describeCutoff(cutoff)}. 0 days means the day itself.</p>
        ) : (
          <p className="text-sm text-destructive">
            Please enter a number of days from 0 to {MAX_CUTOFF_DAYS} and a time.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={buttonStyles('solid', 'px-10')}
          disabled={!changed || !daysOk || !cutoffOk || state === 'saving'}
          onClick={save}
        >
          {state === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
        {state === 'saved' && !changed ? <span className="text-sm text-stone">Saved.</span> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="border-t border-border pt-12">
        <CollectionPlacesSettings />
      </div>

      <div className="border-t border-border pt-12">
        <HomePhotoSettings />
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="caps text-sm text-charcoal">{children}</h2>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm text-charcoal">{label}</span>
      {children}
    </label>
  )
}
