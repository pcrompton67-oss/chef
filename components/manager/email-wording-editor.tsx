'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { buttonStyles } from '@/components/site/button-styles'
import { EMAIL_KINDS, renderPreview, type BankDetails, type EmailKind } from '@/lib/email-templates'
import {
  defaultText,
  emptyWording,
  normalizeWording,
  PLACEHOLDERS,
  WORDING_KINDS,
  type EmailWording,
  type Texts,
  type WordingKind,
  type WordingPart,
} from '@/lib/email-wording'
import { OWNER_EMAIL } from '@/lib/site'
import { cn } from '@/lib/utils'

/*
 * Console → Emails: pick an email, change its opening and closing (and the
 * shared sign-off) in English and French, let Claude suggest the French,
 * and see the preview change as you type (issue #36). Everything else in the
 * emails (order, amounts, bank details, address, links) stays automatic.
 */

type Loaded = { wording?: EmailWording; frenchReady?: boolean; error?: string }

const isEditable = (k: EmailKind): k is WordingKind => (WORDING_KINDS as readonly string[]).includes(k)

/** What the boxes show: Eleanor's text, or the original where she hasn't written any. */
function withDefaults(w: EmailWording): EmailWording {
  const f = emptyWording()
  for (const k of WORDING_KINDS)
    for (const part of ['opening', 'closing'] as const)
      for (const loc of ['en', 'fr'] as const)
        f.emails[k][part][loc] = w.emails[k][part][loc] || defaultText(k, part, loc)
  for (const k of ['signOff', 'signature'] as const)
    for (const loc of ['en', 'fr'] as const) f[k][loc] = w[k][loc] || defaultText(k, null, loc)
  return f
}

export function EmailWordingEditor({ bank }: { bank: BankDetails }) {
  const remote = useSWR<Loaded>('/api/manager/emails/wording', fetcher)
  const [form, setForm] = useState<EmailWording | null>(null)
  const [dirty, setDirty] = useState(false)
  const [kind, setKind] = useState<EmailKind>('received')
  const [lang, setLang] = useState<'en' | 'fr'>('en')
  const [plain, setPlain] = useState(false)
  const [busy, setBusy] = useState<'' | 'save' | 'french' | 'test'>('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (remote.data?.wording && !dirty) setForm(withDefaults(remote.data.wording))
  }, [remote.data, dirty])

  // Warn before leaving the page with unsaved wording.
  useEffect(() => {
    if (!dirty) return
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const shown = useMemo(() => (form ? normalizeWording(form) : undefined), [form])
  const email = useMemo(() => renderPreview(kind, lang, bank, shown), [kind, lang, bank, shown])

  if (remote.data?.error) return <p className="text-sm text-destructive">The email wording couldn’t be loaded.</p>
  if (!form) return <p className="text-sm text-stone">Loading…</p>

  const englishOnly = kind === 'owner' || kind === 'weekly'
  const info = EMAIL_KINDS.find((k) => k.id === kind)!
  const lng = englishOnly ? 'en' : lang

  const change = (next: EmailWording) => {
    setForm(next)
    setDirty(true)
    setMessage(null)
  }
  const setBox = (k: WordingKind, part: WordingPart, loc: 'en' | 'fr', value: string) =>
    change({
      ...form,
      emails: { ...form.emails, [k]: { ...form.emails[k], [part]: { ...form.emails[k][part], [loc]: value } } },
    })
  const setShared = (k: 'signOff' | 'signature', loc: 'en' | 'fr', value: string) =>
    change({ ...form, [k]: { ...form[k], [loc]: value } })

  async function save() {
    setBusy('save')
    setMessage(null)
    try {
      const res = await send('/api/manager/emails/wording', 'PUT', form)
      setDirty(false)
      setForm(withDefaults(res.wording))
      await remote.mutate({ ...remote.data, wording: res.wording }, { revalidate: false })
      setMessage({ kind: 'ok', text: 'Saved. Emails sent from now on use this wording.' })
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save.' })
    } finally {
      setBusy('')
    }
  }

  async function suggestFrench(k: WordingKind) {
    // Only what Eleanor has changed: the original wording already has its own French.
    const boxes: { get: () => string; set: (w: EmailWording, fr: string) => void; changed: boolean }[] = [
      ...(['opening', 'closing'] as const).map((part) => ({
        get: () => form!.emails[k][part].en,
        set: (w: EmailWording, fr: string) => (w.emails[k][part].fr = fr),
        changed: form!.emails[k][part].en.trim() !== defaultText(k, part, 'en').trim(),
      })),
      ...(['signOff', 'signature'] as const).map((s) => ({
        get: () => form![s].en,
        set: (w: EmailWording, fr: string) => (w[s].fr = fr),
        changed: form![s].en.trim() !== defaultText(s, null, 'en').trim(),
      })),
    ].filter((b) => b.changed && b.get().trim())
    if (!boxes.length) {
      setMessage({ kind: 'ok', text: 'The English is still the original wording, which already has its French.' })
      return
    }
    setBusy('french')
    setMessage(null)
    try {
      const res = await send('/api/manager/emails/wording/french', 'POST', { texts: boxes.map((b) => b.get()) })
      const next: EmailWording = JSON.parse(JSON.stringify(form))
      boxes.forEach((b, i) => {
        if (res.french[i]) b.set(next, res.french[i])
      })
      change(next)
      setLang('fr')
      setMessage({ kind: 'ok', text: 'French suggested by Claude. Please read it through, change anything you like, then save.' })
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'No French suggestion came back.' })
    } finally {
      setBusy('')
    }
  }

  function resetEmail(k: WordingKind) {
    if (!window.confirm('Put back the original opening and closing for this email (English and French)? Nothing is saved until you press Save.')) return
    const next: EmailWording = JSON.parse(JSON.stringify(form))
    for (const part of ['opening', 'closing'] as const)
      for (const loc of ['en', 'fr'] as const) next.emails[k][part][loc] = defaultText(k, part, loc)
    change(next)
  }

  async function sendTest(k: WordingKind) {
    setBusy('test')
    setMessage(null)
    try {
      const res = await send('/api/manager/emails/test', 'POST', { kind: k, locale: lng, wording: form })
      setMessage({ kind: 'ok', text: res.message ?? `Test sent to ${OWNER_EMAIL}.` })
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'The test couldn’t be sent.' })
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="space-y-6">
      <Heading>The emails, in your words</Heading>
      <p className="text-sm text-stone">
        Choose an email to see it. For the emails to customers you can write your own opening and closing, in
        English and French; the order, amounts, bank details, address and links are always filled in for you.
        The preview changes as you type.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Email">
        {EMAIL_KINDS.map((k) => (
          <Choice key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
            {k.label}
          </Choice>
        ))}
      </div>
      <p className="text-sm text-stone">{info.when}</p>

      {isEditable(kind) ? (
        <div className="space-y-6 border border-border bg-background p-4 sm:p-6">
          <Pair
            label="Opening"
            hint={
              kind === 'signup'
                ? 'The paragraph after “Hello,”, before the button.'
                : kind === 'confirmed'
                  ? 'The paragraph after “Hello …,”. Used whether or not a deposit was paid, so keep it general.'
                  : 'The paragraph after “Hello …,”.'
            }
            value={form.emails[kind].opening}
            onChange={(loc, v) => setBox(kind, 'opening', loc, v)}
          />
          <Pair
            label="Closing"
            hint="A paragraph just before the sign-off. Leave empty for none."
            value={form.emails[kind].closing}
            onChange={(loc, v) => setBox(kind, 'closing', loc, v)}
          />
          <p className="text-xs leading-relaxed text-stone">
            {kind === 'signup'
              ? 'This email isn’t about an order, so {name}, {evening} and {date} can’t be used in it.'
              : <>You can type {PLACEHOLDERS.map((p, i) => (
                  <span key={p.key}>{i ? (i === PLACEHOLDERS.length - 1 ? ' and ' : ', ') : ''}<code className="text-charcoal">{p.key}</code> ({p.label})</span>
                ))}; they’re filled in for each customer. A blank line starts a new paragraph.</>}
          </p>

          <div className="space-y-3 border-t border-border pt-6">
            <p className="text-sm text-charcoal">Sign-off <span className="text-stone">(the same in every email)</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Box label="English" value={form.signOff.en} onChange={(v) => setShared('signOff', 'en', v)} rows={1} />
              <Box label="Français" value={form.signOff.fr} onChange={(v) => setShared('signOff', 'fr', v)} rows={1} />
              <Box label="Name (English)" value={form.signature.en} onChange={(v) => setShared('signature', 'en', v)} rows={1} />
              <Box label="Nom (français)" value={form.signature.fr} onChange={(v) => setShared('signature', 'fr', v)} rows={1} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <button type="button" className={buttonStyles('solid', 'px-8')} disabled={!dirty || !!busy} onClick={save}>
              {busy === 'save' ? 'Saving…' : 'Save wording'}
            </button>
            {remote.data?.frenchReady ? (
              <button type="button" className={buttonStyles('outline', 'px-5 py-2')} disabled={!!busy} onClick={() => suggestFrench(kind)}>
                {busy === 'french' ? 'Asking Claude…' : 'Suggest French'}
              </button>
            ) : null}
            <button type="button" className={buttonStyles('outline', 'px-5 py-2')} disabled={!!busy} onClick={() => sendTest(kind)}>
              {busy === 'test' ? 'Sending…' : `Send me a test (${lng === 'fr' ? 'French' : 'English'})`}
            </button>
            <button type="button" className={buttonStyles('text')} disabled={!!busy} onClick={() => resetEmail(kind)}>
              Back to the original wording
            </button>
          </div>
          <p className="text-xs leading-relaxed text-stone">
            {remote.data?.frenchReady
              ? '“Suggest French” asks Claude to translate what you’ve changed in English into the French boxes, for you to check. '
              : 'French suggestions aren’t set up (no Claude key in Vercel). '}
            The test goes to {OWNER_EMAIL} with a made-up order and the wording on screen, saved or not.
            {dirty ? ' You have unsaved changes.' : ''}
          </p>
          {message ? (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-charcoal')}>
              {message.text}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-stone">
          {kind === 'changed'
            ? 'This email lists only what changed, so it has no opening or closing of its own. It ends with your sign-off.'
            : 'This email is only for you, so its wording isn’t changed here.'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Choice active={lng === 'en'} onClick={() => setLang('en')} disabled={englishOnly}>English</Choice>
        <Choice active={lng === 'fr'} onClick={() => setLang('fr')} disabled={englishOnly}>Français</Choice>
        <span className="w-4" />
        <Choice active={!plain} onClick={() => setPlain(false)}>Designed</Choice>
        <Choice active={plain} onClick={() => setPlain(true)}>Plain text</Choice>
      </div>
      <p className="text-sm text-stone">
        {kind === 'signup' ? 'The link shown doesn’t work.' : kind === 'weekly' ? 'The people shown are made up.' : 'The order shown is made up.'}
      </p>
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
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base leading-relaxed text-charcoal outline-none transition-colors focus:border-gold'

function Pair({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: Texts
  onChange: (loc: 'en' | 'fr', v: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-charcoal">{label}</p>
      <p className="text-xs text-stone">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Box label="English" value={value.en} onChange={(v) => onChange('en', v)} rows={4} />
        <Box label="Français" value={value.fr} onChange={(v) => onChange('fr', v)} rows={4} />
      </div>
    </div>
  )
}

function Box({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block space-y-1">
      <span className="caps block text-[0.65rem] text-stone">{label}</span>
      {rows === 1 ? (
        <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea className={inputClass} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="caps text-sm text-charcoal">{children}</h2>
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
