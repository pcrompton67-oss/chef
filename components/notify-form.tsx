'use client'

import { useState, type FormEvent } from 'react'
import { t } from '@/lib/content'
import type { Locale } from '@/lib/i18n'
import { buttonStyles } from '@/components/site/button-styles'

/**
 * Mailing-list sign-up box. Signing up puts the email on the mailing list
 * (lib/customers.ts). On a sold-out evening it's "Tell me about the next one"
 * and `eventSlug` records which evening's page it came from; without
 * `eventSlug` it's the home page's "Hear about new box dates" box.
 */
export function NotifyForm({ locale, eventSlug }: { locale: Locale; eventSlug?: string }) {
  const n = t(locale).notify
  const c = eventSlug ? n : { ...n, title: n.newsTitle, button: n.newsButton }
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, locale, event: eventSlug ?? '' }),
    }).catch(() => null)
    setState(res?.ok ? 'done' : 'error')
  }

  if (state === 'done') {
    return (
      <p role="status" className="mx-auto max-w-md text-center font-display text-xl italic text-charcoal">
        {c.done}
      </p>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-md text-center">
      <p className="caps text-gold-deep">{c.title}</p>
      <span className="rule my-6 w-10" aria-hidden />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-left">
          <span className="text-xs uppercase tracking-[0.22em] text-stone">{c.label}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (state === 'error') setState('idle')
            }}
            aria-invalid={state === 'error'}
            className="mt-2 block w-full rounded-none border-0 border-b border-stone/50 bg-transparent px-0 py-2 text-base text-charcoal outline-none transition-colors duration-300 focus:border-gold"
          />
        </label>
        <button type="submit" disabled={state === 'sending'} className={buttonStyles('outline')}>
          {c.button}
        </button>
      </div>
      {state === 'error' ? (
        <p role="alert" className="mt-3 text-left text-sm text-destructive">
          {c.error}
        </p>
      ) : null}
      <p className="mt-5 text-left text-xs leading-relaxed text-stone">{c.consent}</p>
    </form>
  )
}
