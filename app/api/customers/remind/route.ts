import { NextResponse, type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'
import { formatDeliveryRange, isOrderingOpen } from '@/lib/types'
import { dateLocale } from '@/lib/i18n'
import {
  emailedForMenu,
  listReminderSends,
  listSubscribedRecipients,
  logReminderSend,
  recordReminderRecipients,
} from '@/features/customers/lib'
import {
  buildReminderText,
  defaultReminderBody,
  defaultReminderSubject,
  emailConfigured,
  fillTemplate,
  sendReminderBatch,
  type ReminderInput,
} from '@/features/customers/reminder-email'

export const dynamic = 'force-dynamic'
// Bulk sending takes seconds; the limit is a safety margin.
export const maxDuration = 300

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function siteUrlFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return `${proto}://${host}`
}

async function buildInput(
  req: NextRequest,
): Promise<{ input: ReminderInput; menuId: number | null; open: boolean } | null> {
  const [menu] = await sql`
    SELECT id, sale_date, sale_date_end, cutoff_at, orders_open
    FROM menus WHERE is_active = true ORDER BY id DESC LIMIT 1
  `
  if (!menu) return null
  const deliveryLabel = formatDeliveryRange(
    menu.sale_date as string,
    (menu.sale_date_end as string | null) ?? null,
  )
  const cutoff = menu.cutoff_at ? new Date(menu.cutoff_at as string) : null
  const orderCloseLabel =
    cutoff && !Number.isNaN(cutoff.getTime())
      ? // Always French time: the server runs on UTC, which showed an 18:00
        // deadline as 17:00.
        cutoff.toLocaleString(dateLocale('en'), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        })
      : ''
  return {
    menuId: menu.id as number,
    // Closed once the cutoff has passed or the owner has switched orders off,
    // so the "orders are open" email can't be sent by accident afterwards.
    open: isOrderingOpen(menu as { cutoff_at: string | null; orders_open: boolean }),
    input: {
      deliveryLabel,
      orderCloseLabel,
      siteUrl: siteUrlFrom(req),
    },
  }
}

// GET /api/customers/remind — preview: recipient count, subject, sample body,
// whether email is configured, and recent send history.
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const built = await buildInput(req)
  const recipients = await listSubscribedRecipients()
  const history = await listReminderSends()
  if (!built) {
    return NextResponse.json({
      ready: false,
      reason: 'No active delivery. Create one on the Delivery tab first.',
      recipientCount: recipients.length,
      emailConfigured: emailConfigured(),
      history,
    })
  }
  if (!built.open) {
    return NextResponse.json({
      ready: false,
      reason: "Orders are closed for this delivery, so there's no need to tell people they're open.",
      recipientCount: recipients.length,
      emailConfigured: emailConfigured(),
      history,
    })
  }
  // Always preview with an obviously fake name: previewing with a real
  // customer's name led to that name being pasted into the template and
  // sent to everyone.
  const sample = { name: 'Sarah Example', unsubscribe_token: 'example' }
  const emailed = built.menuId ? await emailedForMenu(built.menuId) : new Set<string>()
  const alreadySent = recipients.filter((r) => emailed.has(r.email.toLowerCase())).length
  return NextResponse.json({
    ready: true,
    recipientCount: recipients.length,
    alreadySent,
    remaining: recipients.length - alreadySent,
    emailConfigured: emailConfigured(),
    // Editable templates plus the values that fill them, so the manager UI
    // can render a live preview without another round trip.
    subjectTemplate: defaultReminderSubject(),
    bodyTemplate: defaultReminderBody(),
    input: built.input,
    sampleRecipient: sample,
    subject: fillTemplate(defaultReminderSubject(), built.input, sample),
    recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
    history,
  })
}

// POST /api/customers/remind — send "orders open" to every subscribed customer.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const body = (await req.json().catch(() => ({}))) as {
    subject?: string
    body?: string
    everyone?: boolean
  }
  const subjectTemplate = body.subject?.trim() || defaultReminderSubject()
  const bodyTemplate = body.body?.trim() || defaultReminderBody()
  if (subjectTemplate.length > 200 || bodyTemplate.length > 5000) {
    return NextResponse.json(
      { error: 'The email is too long.' },
      { status: 400 },
    )
  }
  const built = await buildInput(req)
  if (!built) {
    return NextResponse.json(
      { error: 'No active delivery to announce.' },
      { status: 400 },
    )
  }
  if (!built.open) {
    return NextResponse.json(
      { error: 'Orders are closed for this delivery, so this email was not sent.' },
      { status: 400 },
    )
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      {
        error:
          'Email is not connected yet. Add a RESEND_API_KEY (and ORDER_EMAIL_FROM) to send reminders, or copy the recipient list below.',
      },
      { status: 400 },
    )
  }
  const menuId = built.menuId
  const subscribed = await listSubscribedRecipients()
  // By default only people who have not had this delivery's email yet, so
  // pressing the button again after a partial send never doubles up.
  const emailed = menuId && !body.everyone ? await emailedForMenu(menuId) : new Set<string>()
  const recipients = subscribed.filter((r) => !emailed.has(r.email.toLowerCase()))
  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, total: 0, failed: [] })
  }
  const result = await sendReminderBatch(
    { subject: subjectTemplate, body: bodyTemplate },
    built.input,
    recipients,
    menuId ? (emails) => recordReminderRecipients(menuId, emails) : undefined,
  )
  await logReminderSend({
    menu_id: menuId,
    subject: fillTemplate(subjectTemplate, built.input, { name: '' }),
    recipient_count: recipients.length,
    sent_count: result.sent,
  })
  return NextResponse.json(result)
}
