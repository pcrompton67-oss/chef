'use client'

import { useEffect, useState, type ReactNode } from 'react'

type Role = 'manager'

function storageKey(role: Role) {
  return `msr:pin:${role}`
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
      <div className="flex min-h-dvh items-center justify-center bg-background text-brand-dark/60">
        Loading…
      </div>
    )
  }

  if (unlocked) return <>{children}</>

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="Magnificent Sausage Rolls logo"
          className="mx-auto mb-4 h-24 w-24 rounded-full object-cover ring-2 ring-brand-yellow/70"
        />
        <h1 className="text-center font-display text-2xl font-bold text-brand-green">
          {title}
        </h1>
        <p className="mt-1 text-center text-sm text-brand-dark/70">
          Enter your PIN to continue.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="mt-5 w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30"
        />
        {error ? (
          <p className="mt-2 text-center text-sm text-destructive">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy || pin.length === 0}
          className="mt-4 w-full rounded-md bg-brand-green py-3 font-display text-lg font-bold text-brand-cream transition-colors hover:bg-brand-green-dark disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
