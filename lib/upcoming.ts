import { sql } from '@/lib/db'
import type { UpcomingDelivery } from '@/lib/upcoming-shared'

export * from '@/lib/upcoming-shared'

// A Friday/Saturday pair stays listed until its last day has passed (French time),
// so once a delivery is over the next one moves up on its own.
export async function listUpcomingDeliveries(limit: number): Promise<UpcomingDelivery[]> {
  const rows = await sql`
    SELECT id,
           to_char(start_date, 'YYYY-MM-DD') AS start_date,
           to_char(end_date, 'YYYY-MM-DD') AS end_date,
           note
    FROM upcoming_deliveries
    WHERE COALESCE(end_date, start_date) >= (now() AT TIME ZONE 'Europe/Paris')::date
    ORDER BY start_date ASC, id ASC
    LIMIT ${limit}
  `
  return rows as UpcomingDelivery[]
}

export async function removePastDeliveries(): Promise<void> {
  await sql`
    DELETE FROM upcoming_deliveries
    WHERE COALESCE(end_date, start_date) < (now() AT TIME ZONE 'Europe/Paris')::date
  `
}
