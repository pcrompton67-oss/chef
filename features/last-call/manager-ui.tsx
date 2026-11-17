'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { CustomerApi } from '@/features/customers/manager-ui'
import { EmailCard, EmailEditor, SendButton } from '@/features/customers/email-card'
import type { LastCallPreview } from './lib'
import { describeSendResult, type SendResult } from '@/lib/send-result'
import { LAST_CALL_PLACEHOLDERS, buildLastCallText, fillLastCall } from './email'

type Data = LastCallPreview & { emailConfigured: boolean }

// Always preview with an obviously fake name, never a real customer's.
const SAMPLE = { name: 'Sarah Example', unsubscribe_token: 'example' }

// "Last day for orders" card for Delivery → Overview.
export function LastCallPanel({ api }: { api: CustomerApi }) {
  const { data, mutate: refetch } = useSWR<Data>(
    '/api/last-call',
    api.fetcher as (url: string) => Promise<Data>,
  )
  // null = not edited, use the standard text from the server.
  const [subjectDraft, setSubjectDraft] = useState<string | null>(null)
  const [bodyDraft, setBodyDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  if (!data) return null

  const subject = subjectDraft ?? (data.ready ? data.subjectTemplate : '')
  const body = bodyDraft ?? (data.ready ? data.bodyTemplate : '')
  const preview = data.ready
    ? {
        subject: fillLastCall(subject, data.values, SAMPLE),
        body: buildLastCallText(body, data.values, SAMPLE),
      }
    : null

  async function send() {
    if (!data?.ready || !preview) return
    const n = data.remaining
    if (!confirm(`Email ${n} customer${n === 1 ? '' : 's'} who haven't ordered yet?\n\nSubject: ${preview.subject}`)) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const r = (await api.send('/api/last-call', 'POST', { subject, body })) as SendResult
      setResult(describeSendResult(r))
      await refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const status = !data.ready
    ? data.reason
    : `${data.listCount} on the email list, ${data.orderedCount} already ordered. ` +
      (data.remaining > 0
        ? `${data.remaining} still to remind${data.alreadySent ? ` (${data.alreadySent} already had it)` : ''}.`
        : data.alreadySent
          ? `All ${data.alreadySent} who hadn't ordered have had it.`
          : 'Nobody left to remind.')

  return (
    <EmailCard
      title="Last day for orders"
      status={status}
      open={open}
      onToggle={() => {
        if (!open) void refetch()
        setOpen((o) => !o)
      }}
      canOpen={data.ready}
      actions={
        data.ready && data.emailConfigured ? (
          <SendButton
            busy={busy}
            disabled={data.remaining === 0}
            onClick={send}
            label={
              data.alreadySent > 0
                ? `Send to the ${data.remaining} remaining`
                : `Send to ${data.remaining}`
            }
          />
        ) : null
      }
      result={result}
      error={error}
    >
      {!data.emailConfigured ? (
        <p className="mb-3 text-xs text-brand-dark/60">
          Sending is off until an email provider is connected.
        </p>
      ) : null}
      <EmailEditor
        subject={subject}
        body={body}
        onSubject={setSubjectDraft}
        onBody={setBodyDraft}
        placeholders={LAST_CALL_PLACEHOLDERS}
        preview={preview}
        edited={subjectDraft !== null || bodyDraft !== null}
        onReset={() => {
          setSubjectDraft(null)
          setBodyDraft(null)
        }}
        warning={
          /\{\{\s*closes\s*\}\}/.test(body)
            ? undefined
            : 'The email does not say when orders close. Add {{closes}} so customers know the deadline.'
        }
      />
    </EmailCard>
  )
}
