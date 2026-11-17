import type { NextRequest } from 'next/server'

// A single privileged role: Eleanor's management console.
export type Role = 'manager'

function expectedPin(_role: Role): string | undefined {
  return process.env.MANAGER_PIN
}

/** Compares the supplied PIN against the configured manager PIN. */
export function verifyPin(role: Role, pin: string | null | undefined): boolean {
  const expected = expectedPin(role)
  if (!expected || !pin) return false
  return pin === expected
}

/** Reads the PIN from the `x-pin` header of an incoming request. */
export function checkRequestPin(req: NextRequest, role: Role): boolean {
  const pin = req.headers.get('x-pin')
  return verifyPin(role, pin)
}
