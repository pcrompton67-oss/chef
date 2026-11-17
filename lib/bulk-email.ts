import { randomUUID } from 'node:crypto'
import { resolveSender } from '@/lib/email'
import type { SendResult } from '@/lib/send-result'

// Sends many personal emails through Resend quickly and safely. Used by the
// pickup reminders, the "orders open" and "last day" emails, and sign-ups.
//
// Emails go in groups of up to 100 per request (Resend's batch limit), so
// even a big list takes seconds. Sending one at a time (about a second each)
// used to run past the time limit and stop partway.

export type OutgoingEmail = { to: string; subject: string; text: string }

const SINGLE_URL = 'https://api.resend.com/emails'
const BATCH_URL = 'https://api.resend.com/emails/batch'
const BATCH_SIZE = 100

// sent: accepted. refused: Resend said no to this request (e.g. a bad
// address). unknown: no reply, it may or may not have gone out. limit: the
// account's daily or monthly allowance is used up. down: Resend kept failing.
type Outcome = 'sent' | 'refused' | 'unknown' | 'limit' | 'down'

/**
 * Sends every email and calls `onSent` with the addresses of each group that
 * went out, so the caller can record who has had it. If Resend's sending
 * limit is reached or Resend stops working, it stops straight away rather
 * than retrying for minutes, and `stopped` says why. Never throws for Resend
 * problems.
 */
export async function sendInBulk(
  emails: OutgoingEmail[],
  onSent: (addresses: string[]) => Promise<void>,
  logTag: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: 0, total: emails.length, failed: emails.map((e) => e.to) }
  const { from } = resolveSender()
  // One key per group for this run only: a retry of the same request is
  // recognised by Resend and never sent twice, while a deliberate later
  // resend is a new run with new keys.
  const runId = randomUUID()
  let sent = 0
  const failed: string[] = []
  const stop = (reason: 'limit' | 'down', fromIndex: number): SendResult => {
    console.error(`[${logTag}] stopped: ${reason}`)
    failed.push(...emails.slice(fromIndex).map((e) => e.to))
    return { sent, total: emails.length, failed, stopped: reason }
  }

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const group = emails.slice(i, i + BATCH_SIZE).map((e) => ({ from, ...e }))
    const outcome = await post(apiKey, BATCH_URL, group, `${runId}-${i}`, logTag)
    if (outcome === 'limit' || outcome === 'down') return stop(outcome, i)
    if (outcome === 'sent') {
      await onSent(group.map((e) => e.to))
      sent += group.length
      continue
    }
    if (outcome === 'unknown') {
      // No clear answer from Resend: some may have gone out. Don't resend
      // here; the console's retry button can be used after checking Resend.
      failed.push(...group.map((e) => e.to))
      continue
    }
    // Resend refused the whole group (for example one bad address). Send this
    // group one by one instead so one problem can't hold up everyone else.
    let noReply = 0
    for (let j = 0; j < group.length; j++) {
      const one = await post(apiKey, SINGLE_URL, group[j], undefined, logTag)
      if (one === 'limit' || one === 'down') return stop(one, i + j)
      if (one === 'sent') {
        sent += 1
        noReply = 0
        await onSent([group[j].to])
      } else {
        failed.push(group[j].to)
        // Several in a row with no reply at all: Resend is unreachable.
        if (one === 'unknown' && ++noReply >= 3) return stop('down', i + j + 1)
      }
      await wait(200)
    }
  }
  return { sent, total: emails.length, failed }
}

/** One request to Resend, retrying only where a retry can help. */
async function post(
  apiKey: string,
  url: string,
  payload: unknown,
  idempotencyKey: string | undefined,
  logTag: string,
): Promise<Outcome> {
  let outcome: Outcome = 'unknown'
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (res.ok) return 'sent'
      const text = await res.text().catch(() => '')
      if (res.status === 429) {
        // A used-up daily or monthly allowance won't clear by retrying.
        if (/quota/i.test(text)) {
          console.error(`[${logTag}] sending limit reached`, text)
          return 'limit'
        }
        // Too many per second: wait as Resend asks, then try again.
        const after = Number(res.headers.get('retry-after'))
        outcome = 'refused'
        await wait(after > 0 && after < 10 ? after * 1000 : 1100)
        continue
      }
      if (res.status >= 500) {
        // Resend's own problem: give it a moment, then call it down.
        console.error(`[${logTag}] Resend error`, res.status, text)
        outcome = 'down'
        await wait(1000 * (attempt + 1))
        continue
      }
      console.error(`[${logTag}] rejected`, res.status, text)
      return 'refused'
    } catch {
      // No reply (network hiccup). Batches carry an idempotency key so a
      // retry is safe; single emails have always been retried like this.
      outcome = 'unknown'
      await wait(500)
    }
  }
  return outcome
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
