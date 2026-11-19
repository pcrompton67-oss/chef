import { query } from '@/lib/db'
import type { BankDetails } from '@/lib/email-templates'
import { DEFAULT_CUTOFF, MAX_CUTOFF_DAYS, type CutoffRule } from '@/lib/event-editing'

/**
 * Business settings edited in Console → Settings (issue #6): the bank details
 * customers pay the deposit to, and how many days they have to pay it; and
 * when a new evening's orders close by default (issue #43).
 * Stored in the `settings` table under the key 'business'. Kept as one
 * general record so later settings (e.g. for the restaurant) can join it.
 */

export type BusinessSettings = BankDetails &
  CutoffRule & {
    /** Days a customer has to pay a transfer deposit before the order is flagged "overdue". */
    holdDays: number
  }

export const DEFAULT_HOLD_DAYS = 3
const DEFAULTS: BusinessSettings = { accountName: '', iban: '', bic: '', holdDays: DEFAULT_HOLD_DAYS, ...DEFAULT_CUTOFF }

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
  const before = Math.round(Number(b.cutoffDaysBefore))
  const time = t(b.cutoffTime, 5)
  const value: BusinessSettings = {
    accountName: t(b.accountName, 100),
    iban: t(b.iban, 50).toUpperCase(),
    bic: t(b.bic, 20).toUpperCase(),
    holdDays: Number.isFinite(days) ? Math.min(30, Math.max(1, days)) : DEFAULT_HOLD_DAYS,
    cutoffDaysBefore: Number.isFinite(before)
      ? Math.min(MAX_CUTOFF_DAYS, Math.max(0, before))
      : DEFAULT_CUTOFF.cutoffDaysBefore,
    cutoffTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_CUTOFF.cutoffTime,
  }
  await query(
    `INSERT INTO settings (key, value) VALUES ('business', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  )
  return value
}

/* ---------- Home page photo (issue #37; settings key 'site') ---------- */

/** The photo at the top of the home page; empty = the usual one (CEJ_Food2.jpg). */
export async function getHomeImage(): Promise<string> {
  const [row] = await query<{ value: { homeImage?: string } }>(`SELECT value FROM settings WHERE key = 'site'`)
  return typeof row?.value?.homeImage === 'string' ? row.value.homeImage : ''
}

/** Saves the home page photo (already checked by the caller). */
export async function saveHomeImage(url: string): Promise<string> {
  await query(
    `INSERT INTO settings (key, value) VALUES ('site', jsonb_build_object('homeImage', $1::text))
     ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`,
    [url],
  )
  return url
}
