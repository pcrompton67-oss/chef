'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// The shared look for the console's "email customers" cards: a small box with
// a title, a one-line status and the Send button, which opens to show the
// editable email and a live preview.

const inputClass =
  'w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30'

export function EmailCard({
  title,
  status,
  open,
  onToggle,
  canOpen = true,
  actions,
  result,
  error,
  children,
}: {
  title: string
  status: ReactNode
  open: boolean
  onToggle: () => void
  canOpen?: boolean
  actions?: ReactNode
  result?: string
  error?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-md border border-brand-yellow/60 bg-brand-yellow/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-48 text-sm font-bold uppercase tracking-wide text-brand-dark">
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          {canOpen ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-md border border-brand-dark/20 bg-card px-3 py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-dark/5"
            >
              {open ? 'Close' : 'Open'}
              <ChevronDown
                aria-hidden
                className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-brand-dark/60">{status}</p>
      {result ? <p className="mt-2 text-sm font-semibold text-brand-green">{result}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {open && canOpen ? <div className="mt-4 border-t border-brand-yellow/60 pt-4">{children}</div> : null}
    </div>
  )
}

export function SendButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string
  busy: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="rounded-md bg-brand-green px-4 py-2 font-display text-base font-bold text-brand-cream transition-colors hover:bg-brand-green-dark disabled:opacity-50"
    >
      {busy ? 'Sending… keep this page open' : label}
    </button>
  )
}

export function EmailEditor({
  subject,
  body,
  onSubject,
  onBody,
  placeholders,
  preview,
  warning,
  edited,
  onReset,
}: {
  subject: string
  body: string
  onSubject: (v: string) => void
  onBody: (v: string) => void
  placeholders: readonly { token: string; meaning: string }[]
  preview: { subject: string; body: string } | null
  warning?: string
  edited: boolean
  onReset: () => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/60">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/60">
            Email text
          </span>
          <textarea
            value={body}
            onChange={(e) => onBody(e.target.value)}
            rows={10}
            maxLength={5000}
            className={`${inputClass} resize-y font-mono text-sm leading-relaxed`}
          />
        </label>
        <p className="text-xs leading-relaxed text-brand-dark/60">
          These fill in automatically for each customer:{' '}
          {placeholders.map((p, i) => (
            <span key={p.token}>
              <code className="rounded bg-brand-dark/5 px-1 py-0.5 text-brand-dark">{p.token}</code>{' '}
              {p.meaning}
              {i < placeholders.length - 1 ? ', ' : '.'}
            </span>
          ))}{' '}
          An unsubscribe link is always added at the bottom.
        </p>
        {edited ? (
          <button
            type="button"
            onClick={onReset}
            className="self-start text-xs font-semibold text-brand-dark/60 underline underline-offset-2"
          >
            Reset to the standard text
          </button>
        ) : null}
        {warning ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
          >
            {warning}
          </p>
        ) : null}
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-dark/60">
          What the customer sees
        </p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs leading-relaxed text-brand-dark">
          {preview ? `Subject: ${preview.subject}\n\n${preview.body}` : 'Loading preview…'}
        </pre>
      </div>
    </div>
  )
}
