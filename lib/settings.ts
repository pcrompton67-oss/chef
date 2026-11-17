import { query } from '@/lib/db'
import type { BankDetails } from '@/lib/email-templates'

/**
 * Business settings edited in Console → Settings (issue #6): the bank details
 * customers pay the deposit to, and how many days they have to pay it.
 * Stored in the `settings` table under the key 'business'. Kept as one
 * general record so later settings (e.g. for the restaurant) can join it.
 */

export type BusinessSettings = BankDetails & {
  /** Days a customer has to pay a transfer deposit before the order is flagged "overdue". */
  holdDays: number
}

export const DEFAULT_HOLD_DAYS = 3
const DEFAULTS: BusinessSettings = { accountName: '', iban: '', bic: '', holdDays: DEFAULT_HOLD_DAYS }

export async function getBusinessSettings(): Promise<BusinessSettings> {
  // Bank details used to live with the email settings; read them from there
  // until the Settings tab has been saved once.
  const rows = await query<{ key: string; value: Partial<BusinessSettings> }>(
    `SELECT key, value FROM settings WHERE key IN ('business', 'emails')`,
  )
  const business = rows.find((r) => r.key === 'business')?.value
  if (business) return { ...DEFAULTS, ...business }
  const old = rows.find((r) => r.key === 'emails')?.value ?? {}
  return {
    ...DEFAULTS,
    accountName: old.accountName ?? '',
    iban: old.iban ?? '',
    bic: old.bic ?? '',
  }
}

export async function saveBusinessSettings(raw: unknown): Promise<BusinessSettings> {
  const b = (raw ?? {}) as Record<string, unknown>
  const t = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const days = Math.round(Number(b.holdDays))
  const value: BusinessSettings = {
    accountName: t(b.accountName, 100),
    iban: t(b.iban, 50).toUpperCase(),
    bic: t(b.bic, 20).toUpperCase(),
    holdDays: Number.isFinite(days) ? Math.min(30, Math.max(1, days)) : DEFAULT_HOLD_DAYS,
  }
  await query(
    `INSERT INTO settings (key, value) VALUES ('business', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  )
  return value
}
