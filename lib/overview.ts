import { query } from '@/lib/db'
import { getBusinessSettings } from '@/lib/settings'
import { hasAllergy } from '@/lib/order-editing'
import type { EveningSummary } from '@/lib/evening-summary'

/**
 * Live evenings at a glance (issue #44): every evening open for orders, sold
 * out or with orders closed (not drafts, not done), soonest first, with its
 * orders, dishes, collection points and money added up. Used under the list
 * in Console → Events (test evenings included, tagged) and by the Monday
 * summary email (test evenings left out). PIN only.
 */

// Orders that count against capacity (same rule as the public pages and lib/manager-orders.ts).
const TAKES_PLACES = `(o.status = 'confirmed'
  OR (o.status IN ('held', 'awaiting_transfer')
      AND (o.hold_expires_at IS NULL OR o.hold_expires_at > now())))`

type OrderRow = {
  eventId: string
  pointId: string
  diners: number
  status: string
  takesPlaces: boolean
  overdue: boolean
  payingByCard: boolean
  depositPaid: boolean
  depositCents: number
  balanceCents: number
  balancePaid: boolean
  refundDue: boolean
  refundCents: number
  allergies: string
  newThisWeek: boolean
  cancelledThisWeek: boolean
}

export async function liveEvenings({ includeTest }: { includeTest: boolean }): Promise<EveningSummary[]> {
  const events = await query<{ id: string; title: string; date: string; status: EveningSummary['status']; isTest: boolean; cutoff: string; capacity: number }>(
    `SELECT e.id::text, e.title, e.event_date::text AS date, e.status, e.is_test AS "isTest",
            to_char(e.cutoff_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI') AS cutoff, e.capacity
       FROM events e
      WHERE e.kind = 'dine_at_home' AND e.status IN ('open', 'sold_out', 'closed')
        AND ($1::boolean OR NOT e.is_test)
      ORDER BY e.event_date, e.id`,
    [includeTest],
  )
  if (!events.length) return []
  const ids = events.map((e) => e.id)
  const { holdDays } = await getBusinessSettings()

  const [orders, points, dishes] = await Promise.all([
    query<OrderRow>(
      `SELECT o.event_id::text AS "eventId", o.collection_point_id::text AS "pointId", o.diners, o.status,
              ${TAKES_PLACES} AS "takesPlaces",
              (o.payment_method = 'bank_transfer' AND o.status IN ('held', 'awaiting_transfer')
                AND o.deposit_paid_at IS NULL AND o.deposit_cents > 0 AND o.collected_at IS NULL
                AND o.created_at < now() - make_interval(days => $2)) AS overdue,
              (o.payment_method = 'card' AND o.source = 'website' AND o.status = 'held'
                AND o.deposit_paid_at IS NULL AND o.hold_expires_at > now()) AS "payingByCard",
              o.deposit_paid_at IS NOT NULL AS "depositPaid", o.deposit_cents AS "depositCents",
              o.balance_cents AS "balanceCents", o.balance_paid_at IS NOT NULL AS "balancePaid",
              o.refund_status IN ('requested', 'partial') AS "refundDue", o.refund_cents AS "refundCents",
              COALESCE(o.allergies, '') AS allergies,
              (o.created_at > now() - interval '7 days' AND o.status <> 'expired') AS "newThisWeek",
              (o.status = 'cancelled' AND o.updated_at > now() - interval '7 days') AS "cancelledThisWeek"
         FROM orders o
        WHERE o.event_id = ANY($1::bigint[])`,
      [ids, holdDays],
    ),
    query<{ id: string; eventId: string; place: string; time: string }>(
      `SELECT id::text, event_id::text AS "eventId", place, to_char(collect_time, 'HH24:MI') AS time
         FROM collection_points WHERE event_id = ANY($1::bigint[])
        ORDER BY collect_time, position`,
      [ids],
    ),
    // Each dish of each choice course, with how many diners chose it among orders holding places.
    query<{ eventId: string; course: string; dish: string; count: number }>(
      `SELECT c.event_id::text AS "eventId", c.name AS course, co.name AS dish,
              COALESCE((SELECT sum(l.quantity) FROM order_lines l JOIN orders o ON o.id = l.order_id
                         WHERE l.course_option_id = co.id AND ${TAKES_PLACES}), 0)::int AS count
         FROM courses c JOIN course_options co ON co.course_id = c.id
        WHERE c.event_id = ANY($1::bigint[]) AND c.kind = 'choice'
        ORDER BY c.position, co.position`,
      [ids],
    ),
  ])

  return events.map((e) => {
    const mine = orders.filter((o) => o.eventId === e.id)
    const live = mine.filter((o) => o.takesPlaces)
    const confirmed = live.filter((o) => o.status === 'confirmed')
    const waiting = live.filter((o) => o.status !== 'confirmed')
    const refunds = mine.filter((o) => o.refundDue)
    const newOrders = mine.filter((o) => o.newThisWeek)
    const cancelled = mine.filter((o) => o.cancelledThisWeek)
    const sum = (list: OrderRow[], f: (o: OrderRow) => number) => list.reduce((t, o) => t + f(o), 0)

    const choices: EveningSummary['choices'] = []
    for (const d of dishes.filter((x) => x.eventId === e.id)) {
      let course = choices.find((c) => c.course === d.course)
      if (!course) choices.push((course = { course: d.course, dishes: [] }))
      course.dishes.push({ name: d.dish, count: d.count })
    }

    return {
      ...e,
      placesTaken: sum(live, (o) => o.diners),
      confirmed: { orders: confirmed.length, diners: sum(confirmed, (o) => o.diners) },
      waiting: { orders: waiting.length, diners: sum(waiting, (o) => o.diners) },
      overdue: live.filter((o) => o.overdue).length,
      payingByCard: live.filter((o) => o.payingByCard).length,
      choices,
      points: points
        .filter((p) => p.eventId === e.id)
        .map((p) => ({ place: p.place, time: p.time, diners: sum(live.filter((o) => o.pointId === p.id), (o) => o.diners) })),
      depositsPaidCents: sum(live.filter((o) => o.depositPaid), (o) => o.depositCents),
      balanceDueCents: sum(live.filter((o) => !o.balancePaid), (o) => o.balanceCents),
      refunds: { orders: refunds.length, cents: sum(refunds, (o) => o.refundCents) },
      allergyOrders: live.filter((o) => hasAllergy(o.allergies)).length,
      week: {
        newOrders: newOrders.length,
        newDiners: sum(newOrders, (o) => o.diners),
        cancelled: cancelled.length,
        cancelledDiners: sum(cancelled, (o) => o.diners),
      },
    }
  })
}
