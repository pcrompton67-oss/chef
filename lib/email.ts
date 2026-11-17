import type { Menu, MenuItem, Village } from '@/lib/types'
import {
  deliveryDateFor,
  formatDeliveryRange,
  formatPrice,
  formatSaleDate,
} from '@/lib/types'

// Confirmation email sending. This is written now but stays DORMANT until the
// owner connects an email provider: without RESEND_API_KEY set, sendOrder
// confirmation is a no-op and order creation proceeds normally.
//
// To go live:
//   1. Add a RESEND_API_KEY environment variable.
//   2. Optionally set ORDER_EMAIL_FROM. On a verified domain it is used as the
//      From; a personal address becomes the Reply-To instead.
// No code change is required — the branch below activates automatically.

// The domain verified in the owner's Resend account. Resend only accepts
// senders on a verified domain, so a personal address (Yahoo, Gmail) is
// ignored here. No separate Reply-To is set: a mismatched Reply-To sent the
// Treat Stop's emails to spam, so replies go back to the From address and
// Cloudflare Email Routing forwards them to the owner's inbox.
export const VERIFIED_SENDER = 'Magnificent Sausage Rolls <orders@magnificentsausages.com>'
const VERIFIED_DOMAINS = ['magnificentsausages.com', 'thetreatstop79.com']

export function resolveSender(): { from: string } {
  const configured = process.env.ORDER_EMAIL_FROM?.trim()
  if (!configured) return { from: VERIFIED_SENDER }
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured
  const domain = address.split('@')[1]?.toLowerCase()
  if (domain && VERIFIED_DOMAINS.includes(domain)) return { from: configured }
  return { from: VERIFIED_SENDER }
}

type ConfirmationInput = {
  to: string
  customerName: string
  menu: Pick<Menu, 'name' | 'sale_date' | 'sale_date_end'>
  village: Pick<Village, 'name' | 'pickup_time' | 'delivery_day'> | null
  lines: { item: Pick<MenuItem, 'name' | 'price_cents'>; quantity: number }[]
  notes: string
}

function buildText(input: ConfirmationInput): string {
  const rows = input.lines
    .map(
      (l) =>
        `  ${l.quantity} x ${l.item.name} — ${formatPrice(
          l.item.price_cents * l.quantity,
        )}`,
    )
    .join('\n')
  const total = input.lines.reduce(
    (sum, l) => sum + l.item.price_cents * l.quantity,
    0,
  )

  const dayLabel = customerDayLabel(input)

  const dropOff = input.village
    ? `${input.village.name}${dayLabel ? `, ${dayLabel}` : ''}${
        input.village.pickup_time ? ` at approx. ${input.village.pickup_time}` : ''
      }`
    : 'To be confirmed'

  return [
    `Hi ${input.customerName},`,
    ``,
    dayLabel
      ? `Thanks for your order for our delivery on ${dayLabel}.`
      : `Thanks for your order.`,
    ``,
    `Your order:`,
    rows,
    ``,
    `Total: ${formatPrice(total)}`,
    `Drop-off: ${dropOff}`,
    input.notes ? `Notes: ${input.notes}` : ``,
    ``,
    `Please note: because we deliver around 10 towns a day, drop-off times are`,
    `approximate. Everything is delivered frozen and ready to cook, so please`,
    `get them into the freezer (or the oven!) on the day.`,
    ``,
    `We make, you discover!`,
    `— Magnificent Sausage Rolls & Sausages`,
    `Handcrafted in Valence-en-Poitou 86700`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n')
}

// The customer-facing date for this order: their town's day if known,
// otherwise the delivery's date range. Never the internal delivery name.
function customerDayLabel(input: ConfirmationInput): string {
  const dayDate = deliveryDateFor(input.menu, input.village?.delivery_day)
  return dayDate
    ? formatSaleDate(dayDate)
    : formatDeliveryRange(input.menu.sale_date, input.menu.sale_date_end)
}

// Where new-order alerts go. OWNER_NOTIFY_EMAIL can override it without a code change.
export const OWNER_EMAIL = 'magnificentsausagerolls@yahoo.com'

type OwnerNotificationInput = ConfirmationInput & {
  orderId: number
  // Set when this customer already had an order for the same delivery.
  duplicate?: 'identical' | 'possible' | null
}

/**
 * Tells the owner a website order has arrived. Sent to the owner's inbox
 * whether or not the customer gets a confirmation. Never throws.
 */
export async function sendOwnerNotification(
  input: OwnerNotificationInput,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.OWNER_NOTIFY_EMAIL?.trim() || OWNER_EMAIL
  if (!apiKey) return { sent: false }

  const { from } = resolveSender()
  const total = input.lines.reduce(
    (sum, l) => sum + l.item.price_cents * l.quantity,
    0,
  )
  const dayLabel = customerDayLabel(input)
  const town = input.village?.name ?? 'No town'

  const repeatNote =
    input.duplicate === 'identical'
      ? `HEADS UP: this customer already has an order for this delivery with IDENTICAL items. It may be a duplicate.`
      : input.duplicate === 'possible'
        ? `Heads up: this customer already has another order for this delivery (different items).`
        : null

  const text = [
    `New order #${input.orderId}`,
    ``,
    ...(repeatNote ? [repeatNote, ``] : []),
    `Customer: ${input.customerName}`,
    `Email: ${input.to || '(none given)'}`,
    `Drop-off: ${town}${dayLabel ? `, ${dayLabel}` : ''}${
      input.village?.pickup_time ? ` at approx. ${input.village.pickup_time}` : ''
    }`,
    `Delivery: ${input.menu.name}`,
    ``,
    ...input.lines.map(
      (l) =>
        `  ${l.quantity} x ${l.item.name} — ${formatPrice(
          l.item.price_cents * l.quantity,
        )}`,
    ),
    ``,
    `Total: ${formatPrice(total)}`,
    input.notes ? `Notes: ${input.notes}` : ``,
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `${
          input.duplicate === 'identical' ? 'Possible duplicate: ' : input.duplicate ? 'Repeat order: ' : ''
        }New order: ${input.customerName} — ${town} (${formatPrice(total)})`,
        text,
      }),
    })
    if (!res.ok) {
      console.error('[email] owner notification rejected', await res.text())
    }
    return { sent: res.ok }
  } catch {
    return { sent: false }
  }
}

/**
 * Sends an order confirmation email. Returns `{ sent: boolean }`.
 * When no email provider is configured, this resolves with `{ sent: false }`
 * and never throws, so ordering keeps working.
 */
export async function sendOrderConfirmation(
  input: ConfirmationInput,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const { from } = resolveSender()

  if (!apiKey || !input.to) {
    // Dormant: no provider connected yet. Order still saves.
    return { sent: false }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: (() => {
          const label = customerDayLabel(input)
          return label
            ? `Your Magnificent Sausage Rolls order — ${label}`
            : 'Your Magnificent Sausage Rolls order'
        })(),
        text: buildText(input),
      }),
    })
    if (!res.ok) {
      console.error('[email] confirmation rejected', await res.text())
    }
    return { sent: res.ok }
  } catch {
    // Never let email failure break an order.
    return { sent: false }
  }
}
