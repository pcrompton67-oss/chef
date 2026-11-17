'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import { EMAIL_KINDS, renderEmail, sampleOrder, type EmailKind } from '@/lib/email-templates'
import type { EmailLogRow, EmailSettings } from '@/lib/emails'
import { EMAIL_FROM, EMAIL_REPLY_TO, OWNER_EMAIL } from '@/lib/site'
import { cn } from '@/lib/utils'

/*
 * Console → Emails (issue #13): whether sending is set up, the reminders
 * switch, bank details for the "request received" email, a preview of every
 * email in both languages (with a made-up order), and the recent send log.
 */

type Data = { settings: EmailSettings; log: EmailLogRow[]; sending: boolean; remindersReady: boolean }

const KIND_LABEL: Record<string, string> = Object.fromEntries(EMAIL_KINDS.map((k) => [k.id, k.label]))

export function EmailsTab() {
  const { data, mutate } = useSWR<Data>('/api/manager/emails', fetcher)
  const [bank, setBank] = useState({ accountName: '', iban: '', bic: '' })
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (data?.settings) {
      const { accountName, iban, bic } = data.settings
      setBank({ accountName, iban, bic })
    }
  }, [data?.settings])

  if (!data?.settings) return <p className="text-sm text-stone">Loading…</p>
  const settings = data.settings

  async function save(next: EmailSettings) {
    setSaved('saving')
    setError('')
    try {
      await send('/api/manager/emails', 'PUT', next)
      await mutate()
      setSaved('saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setSaved('idle')
    }
  }

  const changed =
    bank.accountName !== settings.accountName || bank.iban !== settings.iban || bank.bic !== settings.bic

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
            ? 'The 18:00 reminder run is set up.'
            : 'The 18:00 reminder run is not set up yet (CRON_SECRET missing in Vercel).'}
        </Status>
        <p className="text-sm text-stone">
          From {EMAIL_FROM}. Replies go to {EMAIL_REPLY_TO}. Your copies go to {OWNER_EMAIL}.
        </p>
      </section>

      <section className="space-y-3">
        <Heading>Reminders</Heading>
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
      </section>

      <section className="space-y-4">
        <Heading>Bank details</Heading>
        <p className="text-sm text-stone">
          Shown in the “Request received” email so customers can pay the deposit by transfer. Until they are
          filled in, the email says you’ll send them shortly.
        </p>
        <Field label="Account name">
          <input className={inputClass} value={bank.accountName} onChange={(e) => { setBank({ ...bank, accountName: e.target.value }); setSaved('idle') }} />
        </Field>
        <Field label="IBAN">
          <input className={inputClass} value={bank.iban} onChange={(e) => { setBank({ ...bank, iban: e.target.value }); setSaved('idle') }} />
        </Field>
        <Field label="BIC (optional)">
          <input className={inputClass} value={bank.bic} onChange={(e) => { setBank({ ...bank, bic: e.target.value }); setSaved('idle') }} />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className={buttonStyles('solid', 'px-10')}
            disabled={!changed || saved === 'saving'}
            onClick={() => save({ ...settings, ...bank })}
          >
            {saved === 'saving' ? 'Saving…' : 'Save bank details'}
          </button>
          {saved === 'saved' && !changed ? <span className="text-sm text-stone">Saved.</span> : null}
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </section>

      <Preview bank={bank} />

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

function Preview({ bank }: { bank: { accountName: string; iban: string; bic: string } }) {
  const [kind, setKind] = useState<EmailKind>('received')
  const [lang, setLang] = useState<'en' | 'fr'>('en')
  const [plain, setPlain] = useState(false)
  const email = useMemo(() => renderEmail(kind, sampleOrder(lang), bank), [kind, lang, bank])
  const info = EMAIL_KINDS.find((k) => k.id === kind)!

  return (
    <section className="space-y-4">
      <Heading>Preview</Heading>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Email">
        {EMAIL_KINDS.map((k) => (
          <Choice key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
            {k.label}
          </Choice>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Choice active={lang === 'en'} onClick={() => setLang('en')} disabled={kind === 'owner'}>English</Choice>
        <Choice active={lang === 'fr'} onClick={() => setLang('fr')} disabled={kind === 'owner'}>Français</Choice>
        <span className="w-4" />
        <Choice active={!plain} onClick={() => setPlain(false)}>Designed</Choice>
        <Choice active={plain} onClick={() => setPlain(true)}>Plain text</Choice>
      </div>
      <p className="text-sm text-stone">{info.when} The order shown is made up.</p>
      <p className="text-sm text-charcoal">
        <span className="caps mr-2 text-[0.65rem] text-stone">Subject</span>
        {email.subject}
      </p>
      {plain ? (
        <pre className="max-h-[48rem] overflow-auto whitespace-pre-wrap border border-border bg-ivory p-5 font-sans text-sm text-charcoal">
          {email.text}
        </pre>
      ) : (
        <iframe title="Email preview" srcDoc={email.html} className="h-[48rem] w-full border border-border bg-white" />
      )}
    </section>
  )
}

/* ---------- Small pieces ---------- */

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

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-charcoal">
      <span aria-hidden className={cn('mt-2 h-2 w-2 shrink-0', ok ? 'bg-gold' : 'border border-stone')} />
      {children}
    </p>
  )
}

function Choice({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'border px-4 py-2 text-sm transition-colors disabled:opacity-40',
        active ? 'border-charcoal bg-charcoal text-ivory' : 'border-stone/40 text-charcoal hover:border-gold',
      )}
    >
      {children}
    </button>
  )
}
