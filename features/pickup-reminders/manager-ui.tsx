'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { PickupSendLog } from './lib'
import { describeSendResult, type SendResult } from '@/lib/send-result'

type Api = {
  fetcher: (url: string) => Promise<unknown>
  send: (url: string, method: string, body?: unknown) => Promise<unknown>
}

type Status = {
  enabled: boolean
  sendHour: number
  emailConfigured: boolean
  scheduleConfigured: boolean
  tomorrow: {
    date: string
    label: string
    alreadySent: boolean
    missed: number
    recipients: { name: string; email: string; town: string; pickupTime: string }[]
  }
  sample: { subject: string; text: string }
  history: PickupSendLog[]
}

const KEY = '/api/pickup-reminders'

export function PickupReminderPanel({ api }: { api: Api }) {
  const { data, mutate } = useSWR<Status>(KEY, api.fetcher as (u: string) => Promise<Status>)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  if (!data || !data.tomorrow) return null

  const { tomorrow } = data
  const count = tomorrow.recipients.length
  const missed = tomorrow.missed ?? 0
  const catchUp = tomorrow.alreadySent && missed > 0
  const toSend = tomorrow.alreadySent ? missed : count

  async function toggle() {
    if (!data) return
    setBusy(true)
    setError('')
    try {
      await api.send(KEY, 'PATCH', { enabled: !data.enabled })
      await mutate()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sendNow() {
    if (!confirm(`Send tomorrow's pickup reminder to ${toSend} customer${toSend === 1 ? '' : 's'} now?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const r = (await api.send(KEY, 'POST')) as SendResult
      setMessage(describeSendResult(r))
      await mutate()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const statusLine = catchUp
    ? `Tomorrow's reminders (${tomorrow.label}) reached ${count - missed} of ${count} customers. ${missed} still need sending.`
    : tomorrow.alreadySent
    ? `Tomorrow's reminders (${tomorrow.label}) have been sent.`
    : count === 0
      ? `Nobody with an email address has a drop-off tomorrow (${tomorrow.label}).`
      : data.enabled
        ? `${count} customer${count === 1 ? '' : 's'} will be emailed at ${data.sendHour}:00 tonight for ${tomorrow.label}.`
        : `${count} customer${count === 1 ? '' : 's'} have a drop-off tomorrow (${tomorrow.label}). Switch on to email them at ${data.sendHour}:00.`

  return (
    <div className="rounded-md border border-brand-green/40 bg-brand-green/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p id="pickup-reminder-label" className="text-sm font-bold uppercase tracking-wide text-brand-dark">
            Pickup reminder the night before
          </p>
          <p className="text-xs leading-relaxed text-brand-dark/60">
            {`Every evening at ${data.sendHour}:00 (French time), everyone with a drop-off the next day gets an email with their town, time and order.`}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.enabled}
          aria-labelledby="pickup-reminder-label"
          disabled={busy}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 disabled:opacity-60 ${
            data.enabled ? 'bg-brand-green' : 'bg-brand-dark/25'
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${
              data.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="mt-3 text-sm font-semibold text-brand-dark">
        {data.enabled ? 'On. ' : 'Off. '}
        <span className="font-normal">{statusLine}</span>
      </p>

      {!data.scheduleConfigured ? (
        <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          The automatic schedule needs a CRON_SECRET setting before it can run. You can still send manually below.
        </p>
      ) : null}
      {!data.emailConfigured ? (
        <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Email is not connected (RESEND_API_KEY missing).
        </p>
      ) : null}

      {count > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-brand-dark/80">
          {tomorrow.recipients.map((r) => (
            <li key={`${r.email}-${r.town}`} className="flex flex-wrap justify-between gap-2">
              <span>
                {r.name} <span className="text-brand-dark/50">{`(${r.email})`}</span>
              </span>
              <span className="text-brand-dark/60">
                {r.town}
                {r.pickupTime ? ` · ${r.pickupTime}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || toSend === 0 || !data.emailConfigured}
          onClick={sendNow}
          className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold text-background disabled:opacity-50"
        >
          {busy
            ? 'Sending… (about 3 a second)'
            : catchUp
              ? `Send to the ${missed} who missed out`
              : "Send tomorrow's reminders now"}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((s) => !s)}
          className="text-xs font-semibold text-brand-green underline underline-offset-2"
          aria-expanded={showPreview}
        >
          {showPreview ? 'Hide example email' : 'Show example email'}
        </button>
      </div>

      {message ? <p className="mt-2 text-sm text-brand-green">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {showPreview ? (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background p-4 font-mono text-xs leading-relaxed text-brand-dark">
          {`Subject: ${data.sample.subject}\n\n${data.sample.text}`}
        </pre>
      ) : null}

      {data.history.length > 0 ? (
        <p className="mt-3 text-xs text-brand-dark/50">
          {'Recent: '}
          {data.history
            .map(
              (h) =>
                `${new Date(`${h.delivery_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — ${h.sent_count}/${h.recipient_count}${h.trigger === 'manual' ? ' (manual)' : ''}`,
            )
            .join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
