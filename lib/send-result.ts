// The outcome of an email send, and the plain-English message the console
// shows for it. No server code here, so the console pages can use it.

export type SendResult = {
  sent: number
  total: number
  failed: string[]
  /** Set when sending stopped early: Resend's limit was reached, or Resend kept failing. */
  stopped?: 'limit' | 'down'
}

export function describeSendResult(r: SendResult): string {
  const remaining = r.total - r.sent
  if (r.stopped === 'limit') {
    return `Resend's sending limit is reached. ${r.sent} sent; press again later to send the remaining ${remaining}.`
  }
  if (r.stopped === 'down') {
    return `Resend isn't responding. ${r.sent} sent; try again later to send the remaining ${remaining}.`
  }
  if (r.failed.length) {
    return `Sent ${r.sent} of ${r.total}. Could not reach: ${r.failed.join(', ')}. Press the button again to retry just those.`
  }
  return `Sent to ${r.sent} customer${r.sent === 1 ? '' : 's'}.`
}
