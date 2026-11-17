import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n'

// Links to the same page in the other language.
export function LanguageSwitch({ locale, path }: { locale: Locale; path: string }) {
  const other: Locale = locale === 'fr' ? 'en' : 'fr'
  return (
    <Link
      href={localePath(path, other)}
      hrefLang={other}
      lang={other}
      className="rounded-md border border-brand-yellow/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-green-dark"
    >
      {other === 'fr' ? 'Français' : 'English'}
    </Link>
  )
}
