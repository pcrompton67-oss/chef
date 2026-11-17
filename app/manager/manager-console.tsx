'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStoredPin } from '@/components/pin-gate'
import { cn } from '@/lib/utils'

// Helpers for console sections that talk to the API: every request carries
// the verified PIN in the `x-pin` header (checked in lib/pins.ts).
export function pinHeaders(): Record<string, string> {
  return { 'x-pin': getStoredPin('manager') }
}

export const fetcher = (url: string) =>
  fetch(url, { headers: pinHeaders() }).then((r) => r.json())

export async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...pinHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Request failed')
  }
  return res.json().catch(() => ({}))
}

// Console sections. New sections (menus, bookings, …) are added here.
const TABS = [{ id: 'overview', label: 'Overview' }] as const
type Tab = (typeof TABS)[number]['id']

export function ManagerConsole() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="min-h-dvh bg-background pb-16">
      {/* Header and tabs are left off printouts. */}
      <header className="border-b border-border bg-ivory print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link
            href="/"
            aria-label="Back to the website"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl leading-none text-stone transition-colors hover:text-gold-deep"
          >
            ‹
          </Link>
          <Image
            src="/CEJ_Logo.jpg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full"
          />
          <div>
            <h1 className="text-2xl leading-tight text-charcoal">Console</h1>
            <p className="caps mt-0.5 text-[0.65rem] text-stone">
              Eleanor Jessica
            </p>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <nav
          aria-label="Sections"
          className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4"
        >
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(t.id)}
                className={cn(
                  'caps shrink-0 border-b-2 px-3 py-3 transition-colors',
                  active
                    ? 'border-gold text-charcoal'
                    : 'border-transparent text-stone hover:text-charcoal',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {tab === 'overview' ? <Overview /> : null}
      </main>
    </div>
  )
}

function Overview() {
  return (
    <div className="border border-border bg-ivory px-6 py-10 text-center">
      <h2 className="text-3xl text-charcoal">Welcome</h2>
      <span className="rule my-5" aria-hidden />
      <p className="mx-auto max-w-md leading-relaxed text-stone">
        The console is ready. Sections for menus and bookings will appear here
        as they are built.
      </p>
    </div>
  )
}
