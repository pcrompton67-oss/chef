'use client'

import { useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/content'
import { localePath, type Locale } from '@/lib/i18n'
import { buttonStyles } from '@/components/site/button-styles'

/**
 * The unsubscribe page (issue #10), reached from the link in emails. It asks
 * for a click rather than unsubscribing on opening, because some email
 * services open links by themselves to check them.
 */
export function UnsubscribeForm({ locale, token }: { locale: Locale; token: string }) {
  const c = t(locale).unsubscribe
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'invalid' | 'error'>(token ? 'idle' : 'invalid')

  async function unsubscribe() {
    setState('sending')
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null)
    setState(res?.ok ? 'done' : res?.status === 404 ? 'invalid' : 'error')
  }

  const message = state === 'done' ? c.done : state === 'invalid' ? c.invalid : null
  return (
    <div className="mx-auto max-w-md">
      {message ? (
        <p role="status" className="font-display text-xl italic leading-relaxed text-charcoal">
          {message}
        </p>
      ) : (
        <>
          <p className="font-display text-xl leading-relaxed text-charcoal">{c.text}</p>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={state === 'sending'}
            className={buttonStyles('solid', 'mt-10')}
          >
            {c.button}
          </button>
          {state === 'error' ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {c.error}
            </p>
          ) : null}
        </>
      )}
      <div className="mt-12">
        <Link href={localePath('/', locale)} className={buttonStyles('text')}>
          {c.back}
        </Link>
      </div>
    </div>
  )
}
