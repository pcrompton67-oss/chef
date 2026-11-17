'use client'

import { useState } from 'react'
import Link from 'next/link'
import { customersConfig as cfg } from './config'

const TEXT = {
  en: {
    heading: 'Remind me when orders open',
    email: 'Your email',
    name: 'First name',
    button: 'Remind me',
    sending: '…',
    done: "Thanks — you're on the list. We'll email you when orders open.",
    invalid: 'Please check your email address.',
    failed: 'Sorry, something went wrong. Please try again.',
    small: 'Only emails about ordering, unsubscribe any time ·',
    policy: 'data-use policy',
  },
  fr: {
    heading: 'Me prévenir quand les commandes ouvrent',
    email: 'Votre e-mail',
    name: 'Prénom',
    button: 'Me prévenir',
    sending: '…',
    done: 'Merci, vous êtes inscrit(e). Nous vous écrirons quand les commandes ouvriront.',
    invalid: 'Veuillez vérifier votre adresse e-mail.',
    failed: 'Désolé, une erreur est survenue. Veuillez réessayer.',
    small: 'Uniquement des e-mails sur les commandes, désinscription à tout moment ·',
    policy: 'données personnelles (en anglais)',
  },
} as const

const fieldClass =
  'min-w-0 flex-1 rounded-md border border-brand-yellow/40 bg-brand-cream px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark/50 outline-none focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/50'

// "Remind me" box for the home page hero (green background).
export function SignupBox({ locale = 'en' }: { locale?: 'en' | 'fr' }) {
  const t = TEXT[locale]
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'invalid' | 'failed'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('busy')
    try {
      const res = await fetch('/api/customers/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, website, locale }),
      })
      if (res.ok) setState('done')
      else setState(res.status === 400 ? 'invalid' : 'failed')
    } catch {
      setState('failed')
    }
  }

  return (
    <section
      aria-labelledby="signup-heading"
      className="flex w-full max-w-md flex-col items-center gap-3 border-t border-brand-yellow/30 pt-6"
    >
      <h2
        id="signup-heading"
        className="text-xs font-bold uppercase tracking-[0.3em] text-brand-yellow/80"
      >
        {t.heading}
      </h2>
      {state === 'done' ? (
        <p role="status" className="text-pretty text-sm text-brand-cream">
          {t.done}
        </p>
      ) : (
        <form onSubmit={submit} className="flex w-full flex-col items-center gap-2">
          {/* Phones: name and email side by side, button underneath.
              Wider screens: all three on one line. */}
          <div className="grid w-full grid-cols-[7rem_1fr] gap-2 sm:grid-cols-[7rem_1fr_auto]">
            <label className="sr-only" htmlFor="signup-name">{t.name}</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="given-name"
              maxLength={80}
              placeholder={t.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
            <label className="sr-only" htmlFor="signup-email">{t.email}</label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              maxLength={200}
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={state === 'busy'}
              className="col-span-2 rounded-md bg-brand-yellow px-4 py-2 text-sm font-bold sm:col-span-1 text-brand-green transition-colors hover:bg-brand-cream disabled:opacity-60"
            >
              {state === 'busy' ? t.sending : t.button}
            </button>
          </div>
          {/* Spam trap: hidden from people, filled in by bots. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />
          {state === 'invalid' || state === 'failed' ? (
            <p role="alert" className="text-sm font-semibold text-brand-cream">
              {state === 'invalid' ? t.invalid : t.failed}
            </p>
          ) : null}
          <p className="text-pretty text-xs text-brand-cream/60">
            {t.small}{' '}
            <Link href={cfg.policyPath} className="whitespace-nowrap underline underline-offset-2">
              {t.policy}
            </Link>
          </p>
        </form>
      )}
    </section>
  )
}
