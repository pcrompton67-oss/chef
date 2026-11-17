import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { formatSaleDate } from '@/lib/types'
import {
  SEND_HOUR,
  buildPickupEmail,
  getRemindersEnabled,
  listPickupSends,
  missedCountFor,
  parisTomorrow,
  recipientsFor,
  sendPickupReminders,
  setRemindersEnabled,
  wasSentFor,
} from '@/features/pickup-reminders/lib'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// GET — the toggle, tomorrow's recipients and a sample email, plus history.
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const tomorrow = parisTomorrow()
  const [enabled, recipients, alreadySent, history] = await Promise.all([
    getRemindersEnabled(),
    recipientsFor(tomorrow),
    wasSentFor(tomorrow),
    listPickupSends(),
  ])
  const missed = alreadySent ? await missedCountFor(tomorrow, recipients) : recipients.length
  const first = recipients[0]
  return NextResponse.json({
    enabled,
    sendHour: SEND_HOUR,
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    scheduleConfigured: Boolean(process.env.CRON_SECRET),
    tomorrow: {
      date: tomorrow,
      label: formatSaleDate(tomorrow),
      alreadySent,
      missed,
      recipients: recipients.map((r) => ({
        name: r.name,
        email: r.email,
        town: r.town,
        pickupTime: r.pickupTime,
      })),
    },
    sample: buildPickupEmail(
      first
        ? { ...first, name: 'Sarah Example' }
        : {
            name: 'Sarah Example',
            town: 'Civray',
            pickupTime: '11:30',
            lines: [{ name: 'Link & Lush Sausage Rolls', quantity: 2, price_cents: 1000 }],
          },
      tomorrow,
    ),
    history,
  })
}

// PATCH { enabled } — the on/off toggle.
export async function PATCH(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be true or false' }, { status: 400 })
  }
  await setRemindersEnabled(body.enabled)
  return NextResponse.json({ enabled: body.enabled })
}

// POST — send tomorrow's reminders right now instead of waiting for 18:00.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) return unauthorized()
  const result = await sendPickupReminders(parisTomorrow(), 'manual')
  if (result.status === 'not_configured') {
    return NextResponse.json({ error: 'Email is not connected (RESEND_API_KEY missing).' }, { status: 400 })
  }
  if (result.status === 'already_sent') {
    return NextResponse.json({ error: "Tomorrow's reminders have already been sent." }, { status: 409 })
  }
  if (result.status === 'no_orders') {
    return NextResponse.json({ error: 'Nobody with an email address has a drop-off tomorrow.' }, { status: 400 })
  }
  return NextResponse.json(result)
}
