'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Keeps the page's language tag right (French under /fr) when moving between
 * pages without a full reload, e.g. with the language switch (issue #12).
 * The first page load is handled by the small script in app/layout.tsx.
 */
export function HtmlLang() {
  const pathname = usePathname()
  useEffect(() => {
    document.documentElement.lang = /^\/fr(\/|$)/.test(pathname) ? 'fr' : 'en'
  }, [pathname])
  return null
}
