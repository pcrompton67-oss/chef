'use client'

import { useState } from 'react'
import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n'
import { buttonStyles } from '@/components/site/button-styles'

type Wording = {
  text: string
  button: string
  done: string
  invalid: string
  error: string
  back: string
}

/**
 * The one-button pages reached from email links (issue #10): unsubscribing
 * (/unsubscribe) and confirming a sign-up (/confirm-subscription). They ask
 * for a click rather than acting on opening, because some email services
 * open links by themselves to check them.
 */
export function TokenActionForm({
  locale,
  token,
  endpoint,
  c,
}: {
  locale: Locale
  token: string
  endpoint: string
  c: Wording
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'invalid' | 'error'>(token ? 'idle' : 'invalid')

  async function act() {
    setState('sending')
    const res = await fetch(endpoint, {
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
            onClick={act}
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
