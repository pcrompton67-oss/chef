/**
 * Shapes shared by the console's Orders tab (in the browser) and
 * lib/manager-orders.ts (on the server). No database code here.
 */

export type OrderStatus = 'held' | 'awaiting_transfer' | 'confirmed' | 'cancelled' | 'expired'
export type RefundStatus = 'none' | 'requested' | 'partial' | 'refunded'

export type ConsoleOrder = {
  id: string
  createdAt: string // YYYY-MM-DDTHH:MM, Paris
  name: string
  mobile: string
  email: string
  diners: number
  collectionPointId: string
  place: string
  time: string
  allergies: string
  notes: string
  language: 'en' | 'fr'
  source: string
  paymentMethod: string
  status: OrderStatus
  /** Whether this order currently counts against the evening's capacity. */
  takesPlaces: boolean
  /** A bank-transfer deposit not paid within the days set in Settings (places are still held). */
  overdue: boolean
  /** A website card order whose customer is on Stripe's payment page right now (issue #14). */
  payingByCard: boolean
  /** A card order paid on the website with money to give back: its refund can go back through Stripe. */
  cardRefundable: boolean
  totalCents: number
  depositCents: number
  depositPaid: boolean
  balanceCents: number
  balancePaid: boolean
  balanceMethod: string | null
  paymentReference: string
  collected: boolean
  refundStatus: RefundStatus
  refundCents: number
  isTest: boolean
  lines: { optionId: string; quantity: number }[]
}

export type OrderAction =
  | { action: 'deposit_received'; reference?: string }
  | { action: 'collected'; method: 'cash' | 'cheque' }
  | { action: 'undo_collected' }
  | { action: 'cancel' }
  | { action: 'refund_sent' }
  | { action: 'refund_card' }

export type ManualOrderInput = {
  eventId: string
  collectionPointId: string
  diners: number
  choices: Record<string, number>
  name: string
  mobile: string
  email: string
  allergies: string
  notes: string
  language: 'en' | 'fr'
  source: string
  paymentMethod: string
  depositPaid: boolean
  reference: string
  marketing: boolean
  overbook: boolean
}

/** What Eleanor can change on an existing order (issue #21). */
export type OrderChangeInput = {
  collectionPointId: string
  diners: number
  choices: Record<string, number>
  name: string
  mobile: string
  email: string
  allergies: string
  notes: string
  language: 'en' | 'fr'
  overbook: boolean
}

/**
 * Whether an order can still be changed: not cancelled, expired or collected,
 * and not a website card order still waiting for its payment.
 */
export function canChangeOrder(o: Pick<ConsoleOrder, 'status' | 'collected' | 'paymentMethod' | 'source' | 'depositPaid'>) {
  if (o.status !== 'held' && o.status !== 'awaiting_transfer' && o.status !== 'confirmed') return false
  if (o.collected) return false
  return !(o.paymentMethod === 'card' && o.source === 'website' && o.status === 'held' && !o.depositPaid)
}

export type OrderMoney = { totalCents: number; depositCents: number; balanceCents: number; refundCents: number }

/**
 * The money on an order after changing its number of diners (issue #21).
 * Uses the order's own price per person (not today's price of the evening).
 * - Deposit not paid yet: deposit and balance are worked out again.
 * - Deposit paid: it stays as paid and only the balance changes. If the paid
 *   deposit is more than the new total, the difference is a refund to send.
 * `refundCents` is the refund still to send after the change.
 */
export function repriceOrder(
  o: Pick<ConsoleOrder, 'diners' | 'totalCents' | 'depositCents' | 'depositPaid' | 'refundStatus' | 'refundCents'>,
  diners: number,
): OrderMoney {
  const pricePer = Math.round(o.totalCents / o.diners)
  const total = pricePer * diners
  const pendingRefund = o.refundStatus === 'requested' ? o.refundCents : 0
  if (!o.depositPaid) {
    const deposit = Math.min(Math.round(o.depositCents / o.diners) * diners, total)
    return { totalCents: total, depositCents: deposit, balanceCents: total - deposit, refundCents: pendingRefund }
  }
  // A refund still to send from an earlier change is money already paid as deposit.
  const paid = o.depositCents + pendingRefund
  const deposit = Math.min(paid, total)
  return { totalCents: total, depositCents: deposit, balanceCents: total - deposit, refundCents: paid - deposit }
}

export const SOURCE_LABEL: Record<string, string> = {
  website: 'Website',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  messenger: 'Messenger',
  in_person: 'In person',
}

export const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
}

/** Ignores answers like "none", "no", "aucune", "-" in the allergies box. */
export function hasAllergy(text: string) {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, '')
  return Boolean(t) && !/^(none|no|non|nil|nope|nothing|n\/?a|-+|aucune?s?|rien|pas d['’]allergies?|no allergies?|none known)$/.test(t)
}
