import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { checkRequestPin } from '@/lib/pins'
import { parseDeliveryInput } from '@/lib/upcoming-shared'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function readId(params: Params['params']): Promise<number | null> {
  const { id } = await params
  const n = Number(id)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const id = await readId(params)
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = parseDeliveryInput(await req.json().catch(() => ({})))
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const [delivery] = await sql`
      UPDATE upcoming_deliveries
      SET start_date = ${parsed.start_date}, end_date = ${parsed.end_date}, note = ${parsed.note}
      WHERE id = ${id}
      RETURNING id, to_char(start_date, 'YYYY-MM-DD') AS start_date,
                to_char(end_date, 'YYYY-MM-DD') AS end_date, note
    `
    if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ delivery })
  } catch (error) {
    console.error('Upcoming delivery update failed:', error)
    return NextResponse.json({ error: 'Could not save the date' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!checkRequestPin(req, 'manager')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const id = await readId(params)
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    await sql`DELETE FROM upcoming_deliveries WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Upcoming delivery delete failed:', error)
    return NextResponse.json({ error: 'Could not delete the date' }, { status: 500 })
  }
}
