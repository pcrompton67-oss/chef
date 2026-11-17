import { customersConfig as cfg } from '@/features/customers/config'

// The "last day for orders" email text. No database code here, so the
// console can use it to show a live preview while the text is edited.

export type LastCallValues = {
  delivery: string
  closes: string
  siteUrl: string
}

export const LAST_CALL_PLACEHOLDERS = [
  { token: '{{first_name}}', meaning: "the customer's first name" },
  { token: '{{delivery}}', meaning: 'the delivery dates' },
  { token: '{{closes}}', meaning: 'when orders close, e.g. "tomorrow at 18:00"' },
  { token: '{{order_url}}', meaning: 'link to the order page' },
  { token: '{{business}}', meaning: 'your business name' },
] as const

export function defaultLastCallSubject(): string {
  return 'Last day for orders: {{delivery}}'
}

export function defaultLastCallBody(): string {
  return [
    'Hi {{first_name}},',
    '',
    'Last day for orders! Orders close {{closes}} for our delivery on {{delivery}}, just in case you had forgotten...',
    '',
    'Order here: {{order_url}}',
    '',
    'Thanks,',
    '{{business}}',
  ].join('\n')
}

export function fillLastCall(
  template: string,
  values: LastCallValues,
  recipient: { name: string },
): string {
  const map: Record<string, string> = {
    first_name: recipient.name.trim().split(/\s+/)[0] || 'there',
    delivery: values.delivery,
    closes: values.closes,
    order_url: `${values.siteUrl}${cfg.orderPath}`,
    business: cfg.businessName,
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => map[k] ?? m)
}

// The unsubscribe footer is always added and cannot be edited away.
export function buildLastCallText(
  bodyTemplate: string,
  values: LastCallValues,
  recipient: { name: string; unsubscribe_token: string },
): string {
  return [
    fillLastCall(bodyTemplate, values, recipient).trimEnd(),
    '',
    '--',
    "You're receiving this because you asked to be told when orders open.",
    `Unsubscribe: ${values.siteUrl}/unsubscribe?token=${recipient.unsubscribe_token}`,
  ].join('\n')
}
