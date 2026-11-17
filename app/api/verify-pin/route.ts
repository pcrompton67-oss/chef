import { NextResponse, type NextRequest } from 'next/server'
import { verifyPin, type Role } from '@/lib/pins'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    role?: Role
    pin?: string
  }
  const role = body.role
  if (role !== 'manager') {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const ok = verifyPin(role, body.pin)
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 })
}
