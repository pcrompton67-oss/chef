'use client'

import { useState } from 'react'

/**
 * A console form filled from loaded data (issue #30). It is filled again
 * whenever the data changes, except while `keep` is set (unsaved edits); once
 * `keep` is cleared it is filled again from the data.
 *
 * Does the same as copying the data into state in an effect, done the way
 * React prefers: noticing the change while rendering.
 */
export function useLoadedForm<D, F>(
  data: D | undefined,
  toForm: (data: D) => F,
  keep = false,
  initial: F | null = null,
) {
  const [form, setForm] = useState<F | null>(initial)
  const [filledFrom, setFilledFrom] = useState<D | undefined>(undefined)
  const source = keep ? undefined : data
  if (source !== filledFrom) {
    setFilledFrom(source)
    if (source !== undefined) setForm(toForm(source))
  }
  return [form, setForm] as const
}
