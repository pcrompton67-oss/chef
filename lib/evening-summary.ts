/**
 * The "at a glance" summary of live evenings (issue #44), shared by
 * Console → Events (in the browser), the Monday summary email
 * (lib/email-templates.ts) and lib/overview.ts (on the server, which fills it).
 * No database code here.
 */

import type { ManagerStatus } from '@/lib/event-editing'

export type EveningSummary = {
  id: string
  title: string
  date: string // YYYY-MM-DD
  status: ManagerStatus
  isTest: boolean
  cutoff: string // YYYY-MM-DD HH:MM, Paris
  capacity: number
  placesTaken: number
  /** Orders that hold places: confirmed (deposit paid) or waiting for their deposit. */
  confirmed: { orders: number; diners: number }
  waiting: { orders: number; diners: number }
  /** Transfer deposits not paid within the days set in Settings (places still held). */
  overdue: number
  /** Website card orders whose customer is on Stripe's payment page right now. */
  payingByCard: number
  /** Choice courses only: how many of each dish, from orders holding places. */
  choices: { course: string; dishes: { name: string; count: number }[] }[]
  points: { place: string; time: string; diners: number }[]
  depositsPaidCents: number
  /** Balances still to collect on orders holding places. */
  balanceDueCents: number
  refunds: { orders: number; cents: number }
  /** Orders holding places whose allergies box says something real. */
  allergyOrders: number
  /** The last seven days. */
  week: { newOrders: number; newDiners: number; cancelled: number; cancelledDiners: number }
}

/** Short lines for what needs Eleanor's attention on one evening (empty when all is well). */
export function attentionLines(e: EveningSummary, money: (cents: number) => string): string[] {
  const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
  const lines: string[] = []
  if (e.overdue) lines.push(`${n(e.overdue, 'deposit')} overdue`)
  if (e.refunds.orders) lines.push(`${n(e.refunds.orders, 'refund')} to send (${money(e.refunds.cents)})`)
  if (e.allergyOrders) lines.push(`${n(e.allergyOrders, 'order')} with allergies`)
  return lines
}

/** "3 orders · 8 diners" */
export function ordersAndDiners(x: { orders: number; diners: number }): string {
  return `${x.orders} order${x.orders === 1 ? '' : 's'} · ${x.diners} diner${x.diners === 1 ? '' : 's'}`
}
