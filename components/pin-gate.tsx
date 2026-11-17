'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'

type Role = 'manager'

function storageKey(role: Role) {
  return `cej:pin:${role}`
}

export function getStoredPin(role: Role): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem(storageKey(role)) ?? ''
}

/**
 * Gates its children behind a PIN. The verified PIN is kept in sessionStorage
 * so child pages can send it as the `x-pin` header on API calls.
 */
export function PinGate({
  role,
  title,
  children,
}: {
  role: Role
  title: string
  children: ReactNode
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [checked, setChecked] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // On mount, re-validate any stored PIN with the server.
  useEffect(() => {
    const stored = getStoredPin(role)
    if (!stored) {
      setChecked(true)
      return
    }
    fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role, pin: stored }),
    })
      .then((r) => setUnlocked(r.ok))
      .catch(() => setUnlocked(false))
      .finally(() => setChecked(true))
  }, [role])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, pin }),
      })
      if (res.ok) {
        sessionStorage.setItem(storageKey(role), pin)
        setUnlocked(true)
      } else {
        setError('Incorrect PIN. Try again.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!checked) {
    return (
      <div className="caps flex min-h-dvh items-center justify-center bg-background text-stone">
        Loading…
      </div>
    )
  }

  if (unlocked) return <>{children}</>

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-border bg-ivory px-6 py-10 text-center"
      >
        <Image
          src="/CEJ_Logo.jpg"
          alt="Eleanor Jessica, cheffe privée"
          width={112}
          height={112}
          priority
          className="mx-auto h-28 w-28 rounded-full"
        />
        <h1 className="mt-6 text-3xl text-charcoal">{title}</h1>
        <span className="rule my-4" aria-hidden />
        <p className="text-sm text-stone">Enter your PIN to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          aria-label="PIN"
          className="mt-6 w-full border border-input bg-cream px-4 py-3 text-center text-lg tracking-[0.4em] outline-none placeholder:tracking-[0.3em] placeholder:text-stone/60 focus:border-gold"
        />
        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy || pin.length === 0}
          className="caps mt-5 w-full bg-charcoal py-3.5 text-ivory transition-colors duration-500 hover:bg-stone disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
