import { NextResponse, type NextRequest } from 'next/server'
import { checkRequestPin } from '@/lib/pins'
import { lastCallPreview, sendLastCall } from '@/features/last-call/lib'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function siteUrlFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return `${proto}://${host}`
}

// GET — who would get the "last day for orders" email, and a preview.
export async function GET(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ...(await lastCallPreview(siteUrlFrom(req))),
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
  })
}

// POST — send it to everyone on the list who hasn't ordered or had it yet.
export async function POST(req: NextRequest) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not connected.' }, { status: 400 })
  }
  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string }
  const result = await sendLastCall(siteUrlFrom(req), body)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
