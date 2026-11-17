import Link from 'next/link'
import { t } from '@/lib/content'
import { localePath, type Locale } from '@/lib/i18n'

// Links to the same page in the other language.
export function LanguageSwitch({ locale, path }: { locale: Locale; path: string }) {
  const other: Locale = locale === 'fr' ? 'en' : 'fr'
  return (
    <Link
      href={localePath(path, other)}
      hrefLang={other}
      lang={other}
      className="caps border-b border-transparent pb-0.5 text-stone transition-colors hover:border-gold hover:text-gold-deep"
    >
      {t(locale).nav.switchLanguage}
    </Link>
  )
}
