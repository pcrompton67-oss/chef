import { sql } from '@/lib/db'
import { sendInBulk } from '@/lib/bulk-email'
import type { SendResult } from '@/lib/send-result'
import { formatDeliveryRange, isOrderingOpen } from '@/lib/types'
import { listSubscribedRecipients } from '@/features/customers/lib'
import {
  buildLastCallText,
  defaultLastCallBody,
  defaultLastCallSubject,
  fillLastCall,
  type LastCallValues,
} from './email'

// "Last day for orders": a nudge to customers on the reminder list who have
// not ordered for the current delivery yet. Sent by hand from the console.

const TIMEZONE = 'Europe/Paris'

export type LastCallPreview =
  | { ready: false; reason: string }
  | {
      ready: true
      menuId: number
      listCount: number
      orderedCount: number
      alreadySent: number
      remaining: number
      subjectTemplate: string
      bodyTemplate: string
      values: LastCallValues
    }

// The tracking table is created on first use, so no manual database step is
// needed. One row per customer per delivery means nobody is emailed twice.
let tableReady: Promise<unknown> | null = null
function ensureTable() {
  tableReady ??= sql`
    CREATE TABLE IF NOT EXISTS last_call_recipients (
      menu_id integer NOT NULL,
      email text NOT NULL,
      sent_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (menu_id, email)
    )
  `.catch((e) => {
    tableReady = null
    throw e
  })
  return tableReady
}

function parisDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** "tomorrow at 18:00", "today at 18:00" or "on Thursday 19 November at 18:00". */
export function closesLabel(cutoff: Date, now = new Date()): string {
  const time = cutoff.toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
  const today = parisDay(now)
  const tomorrow = parisDay(new Date(now.getTime() + 24 * 3600 * 1000))
  const day = parisDay(cutoff)
  if (day === today) return `today at ${time}`
  if (day === tomorrow) return `tomorrow at ${time}`
  const date = cutoff.toLocaleDateString('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return `on ${date} at ${time}`
}

async function gather(siteUrl: string) {
  const [menu] = await sql`
    SELECT id, sale_date, sale_date_end, cutoff_at, orders_open
    FROM menus WHERE is_active = true ORDER BY id DESC LIMIT 1
  `
  if (!menu) return { reason: 'No active delivery.' } as const
  if (!isOrderingOpen(menu as { cutoff_at: string | null; orders_open: boolean })) {
    return { reason: 'Orders are closed for this delivery, so there is nothing to remind people about.' } as const
  }
  if (!menu.cutoff_at) {
    return { reason: 'This delivery has no order deadline set, so the email has no closing time to give.' } as const
  }
  await ensureTable()
  const menuId = menu.id as number
  const [list, ordered, emailed] = await Promise.all([
    listSubscribedRecipients(),
    sql`SELECT DISTINCT lower(trim(email)) AS email FROM orders
        WHERE menu_id = ${menuId} AND coalesce(trim(email), '') <> ''`,
    sql`SELECT email FROM last_call_recipients WHERE menu_id = ${menuId}`,
  ])
  const orderedSet = new Set(ordered.map((o) => o.email as string))
  const emailedSet = new Set(emailed.map((o) => o.email as string))
  const notOrdered = list.filter((r) => !orderedSet.has(r.email.trim().toLowerCase()))
  const pending = notOrdered.filter((r) => !emailedSet.has(r.email.trim().toLowerCase()))
  const delivery = formatDeliveryRange(
    menu.sale_date as string,
    (menu.sale_date_end as string | null) ?? null,
  )
  const values: LastCallValues = {
    delivery,
    closes: closesLabel(new Date(menu.cutoff_at as string)),
    siteUrl,
  }
  return {
    menuId,
    listCount: list.length,
    orderedCount: list.length - notOrdered.length,
    alreadySent: notOrdered.length - pending.length,
    pending,
    values,
  }
}

export async function lastCallPreview(siteUrl: string): Promise<LastCallPreview> {
  const g = await gather(siteUrl)
  if ('reason' in g) return { ready: false, reason: g.reason! }
  return {
    ready: true,
    menuId: g.menuId,
    listCount: g.listCount,
    orderedCount: g.orderedCount,
    alreadySent: g.alreadySent,
    remaining: g.pending.length,
    subjectTemplate: defaultLastCallSubject(),
    bodyTemplate: defaultLastCallBody(),
    values: g.values,
  }
}

export async function sendLastCall(
  siteUrl: string,
  templates: { subject?: string; body?: string } = {},
): Promise<{ error: string } | SendResult> {
  const g = await gather(siteUrl)
  if ('reason' in g) return { error: g.reason! }
  if (g.pending.length === 0) return { sent: 0, total: 0, failed: [] }
  const subject = templates.subject?.trim() || defaultLastCallSubject()
  const body = templates.body?.trim() || defaultLastCallBody()
  if (subject.length > 200 || body.length > 5000) return { error: 'The email is too long.' }
  const result = await sendInBulk(
    g.pending.map((r) => ({
      to: r.email,
      subject: fillLastCall(subject, g.values, r),
      text: buildLastCallText(body, g.values, r),
    })),
    async (emails) => {
      await sql`
        INSERT INTO last_call_recipients (menu_id, email)
        SELECT ${g.menuId}, unnest(${emails.map((e) => e.trim().toLowerCase())}::text[])
        ON CONFLICT DO NOTHING
      `
    },
    'last-call',
  )
  return result
}
