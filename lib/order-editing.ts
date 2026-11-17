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
