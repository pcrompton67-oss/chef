'use client'

import { useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { EMAIL_KINDS } from '@/lib/email-templates'
import { EmailWordingEditor } from '@/components/manager/email-wording-editor'
import type { EmailLogRow, EmailSettings } from '@/lib/emails'
import { EMAIL_FROM, EMAIL_REPLY_TO, OWNER_EMAIL } from '@/lib/site'
import { cn } from '@/lib/utils'

/*
 * Console → Emails (issue #13): whether sending is set up, the reminders and
 * weekly mailing-list switches (issue #10), a preview of every
 * email in both languages (with a made-up order) where Eleanor can write her
 * own opening and closing (issue #36, email-wording-editor.tsx), and the recent send log.
 */

type Data = { settings: EmailSettings; log: EmailLogRow[]; sending: boolean; remindersReady: boolean }

const KIND_LABEL: Record<string, string> = Object.fromEntries(EMAIL_KINDS.map((k) => [k.id, k.label]))

export function EmailsTab() {
  const { data, mutate } = useSWR<Data>('/api/manager/emails', fetcher)
  const [error, setError] = useState('')

  if (!data?.settings) return <p className="text-sm text-stone">Loading…</p>
  const settings = data.settings

  async function save(next: EmailSettings) {
    setError('')
    try {
      await send('/api/manager/emails', 'PUT', next)
      await mutate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <Heading>Sending</Heading>
        <Status ok={data.sending}>
          {data.sending
            ? 'Emails are being sent.'
            : 'Emails are not being sent yet (no Resend key). Orders still work; each email is logged as “skipped”.'}
        </Status>
        <Status ok={data.remindersReady}>
          {data.remindersReady
            ? 'The 18:00 reminders and Monday emails are set up.'
            : 'The 18:00 reminders and Monday emails are not set up yet (CRON_SECRET missing in Vercel).'}
        </Status>
        <p className="text-sm text-stone">
          From {EMAIL_FROM}. Replies go to {EMAIL_REPLY_TO}. Your copies go to {OWNER_EMAIL}.
        </p>
      </section>

      <section className="space-y-3">
        <Heading>Automatic emails</Heading>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-gold"
            checked={settings.remindersOn}
            onChange={(e) => save({ ...settings, remindersOn: e.target.checked })}
          />
          <span className="text-charcoal">
            Send a reminder at 18:00 the day before each evening
            <span className="block text-sm text-stone">
              Confirmed orders only, once per order. Gives the address, time and balance due.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-gold"
            checked={settings.weeklyListOn}
            onChange={(e) => save({ ...settings, weeklyListOn: e.target.checked })}
          />
          <span className="text-charcoal">
            Send me my mailing list every Monday at 8:00
            <span className="block text-sm text-stone">
              Who joined and who unsubscribed that week, with the full list attached as a spreadsheet.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-gold"
            checked={settings.summaryOn}
            onChange={(e) => save({ ...settings, summaryOn: e.target.checked })}
          />
          <span className="text-charcoal">
            Send me a summary of my evenings every Monday at 8:00
            <span className="block text-sm text-stone">
              A separate email: places, orders, dishes, collection points and money for each live evening, and what changed
              that week. Not sent when no evening is live. Test evenings are left out.
            </span>
          </span>
        </label>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </section>

      <section className="space-y-3">
        <Heading>Bank details</Heading>
        <p className="text-sm text-stone">
          {settings.iban
            ? `The “Request received” email gives your bank details (${settings.accountName}, ${settings.iban}).`
            : 'Your bank details are not filled in yet, so the “Request received” email says you’ll send them shortly.'}{' '}
          Change them in Settings.
        </p>
      </section>

      <EmailWordingEditor bank={settings} />

      <section className="space-y-3">
        <Heading>Recent emails</Heading>
        {data.log.length ? (
          <ul className="divide-y divide-border border-y border-border text-sm">
            {data.log.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-0.5 py-2">
                <span className="text-stone">{r.sentAt}</span>
                <span className="text-charcoal">{KIND_LABEL[r.kind] ?? r.kind}</span>
                <span className="break-all text-charcoal">{r.to}</span>
                <span className={cn('caps text-[0.65rem]', r.status === 'failed' ? 'text-destructive' : 'text-stone')}>
                  {r.status}
                </span>
                {r.error ? <span className="basis-full text-stone">{r.error}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone">No emails yet.</p>
        )}
      </section>
    </div>
  )
}

/* ---------- Small pieces ---------- */

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="caps text-sm text-charcoal">{children}</h2>
}

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-charcoal">
      <span aria-hidden className={cn('mt-2 h-2 w-2 shrink-0', ok ? 'bg-gold' : 'border border-stone')} />
      {children}
    </p>
  )
}
