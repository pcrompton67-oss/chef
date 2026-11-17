import { customersConfig as cfg } from './config'
import { sendInBulk } from '@/lib/bulk-email'
import type { SendResult } from '@/lib/send-result'

export type ReminderInput = {
  deliveryLabel: string
  orderCloseLabel: string
  siteUrl: string
}

// Placeholders the manager can use when editing the email. They are swapped
// per recipient at send time, so the manager sees {{first_name}} in the editor
// but each customer receives their own name.
export const REMINDER_PLACEHOLDERS = [
  { token: '{{first_name}}', meaning: "the customer's first name" },
  { token: '{{delivery}}', meaning: 'the delivery dates' },
  { token: '{{order_url}}', meaning: 'link to the order page' },
  { token: '{{cutoff}}', meaning: 'the order deadline' },
  { token: '{{business}}', meaning: 'your business name' },
] as const

export function defaultReminderSubject(): string {
  return 'Orders open for {{delivery}}'
}

export function defaultReminderBody(): string {
  return [
    'Hi {{first_name}},',
    '',
    'Orders are now open for our next delivery: {{delivery}}.',
    '',
    'Order here: {{order_url}}',
    '',
    'Please get your order in by {{cutoff}}.',
    '',
    'Thanks,',
    '{{business}}',
  ].join('\n')
}

export function fillTemplate(
  template: string,
  input: ReminderInput,
  recipient: { name: string },
): string {
  const firstName = recipient.name.trim().split(/\s+/)[0] || 'there'
  const values: Record<string, string> = {
    first_name: firstName,
    delivery: input.deliveryLabel,
    order_url: `${input.siteUrl}${cfg.orderPath}`,
    cutoff: input.orderCloseLabel || 'the deadline shown on the website',
    business: cfg.businessName,
  }
  return template.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (match, key: string) => values[key] ?? match,
  )
}

// The unsubscribe footer is always appended and cannot be edited away, so
// every marketing email keeps a working opt-out link.
export function buildReminderText(
  bodyTemplate: string,
  input: ReminderInput,
  recipient: { name: string; unsubscribe_token: string },
): string {
  const unsubscribeUrl = `${input.siteUrl}/unsubscribe?token=${recipient.unsubscribe_token}`
  return [
    fillTemplate(bodyTemplate, input, recipient).trimEnd(),
    '',
    '--',
    "You're receiving this because you asked to be told when orders open.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

// Sends one reminder per recipient so each gets a personal name and
// unsubscribe link. They go to Resend in groups of up to 100 per request
// (see lib/bulk-email.ts), so even a long customer list takes seconds.
export async function sendReminderBatch(
  templates: { subject: string; body: string },
  input: ReminderInput,
  recipients: { name: string; email: string; unsubscribe_token: string }[],
  onSent?: (emails: string[]) => Promise<void>,
): Promise<SendResult> {
  return sendInBulk(
    recipients.map((r) => ({
      to: r.email,
      subject: fillTemplate(templates.subject, input, r),
      text: buildReminderText(templates.body, input, r),
    })),
    onSent ?? (async () => {}),
    'customers',
  )
}
