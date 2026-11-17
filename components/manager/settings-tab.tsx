'use client'

import { useEffect, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import type { BusinessSettings } from '@/lib/settings'

/*
 * Console → Settings (issue #6): the bank details customers pay the deposit
 * to (shown on the thank-you page and in the "request received" email), and
 * how many days they have to pay before the order is flagged as overdue.
 * More business settings can be added here later.
 */

type Form = { accountName: string; iban: string; bic: string; holdDays: string }

const toForm = (s: BusinessSettings): Form => ({
  accountName: s.accountName,
  iban: s.iban,
  bic: s.bic,
  holdDays: String(s.holdDays),
})

export function SettingsTab() {
  const { data, mutate } = useSWR<{ settings: BusinessSettings }>('/api/manager/settings', fetcher)
  const [form, setForm] = useState<Form | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (data?.settings) setForm(toForm(data.settings))
  }, [data?.settings])

  if (!data?.settings || !form) return <p className="text-sm text-stone">Loading…</p>

  const saved = toForm(data.settings)
  const changed = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k])
  const days = Number(form.holdDays)
  const daysOk = Number.isInteger(days) && days >= 1 && days <= 30

  function set(k: keyof Form, v: string) {
    setForm({ ...form!, [k]: v })
    setState('idle')
  }

  async function save() {
    setState('saving')
    setError('')
    try {
      await send('/api/manager/settings', 'PUT', { ...form, holdDays: days })
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

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={buttonStyles('solid', 'px-10')}
          disabled={!changed || !daysOk || state === 'saving'}
          onClick={save}
        >
          {state === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
        {state === 'saved' && !changed ? <span className="text-sm text-stone">Saved.</span> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
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
