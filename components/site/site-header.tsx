import Image from 'next/image'
import Link from 'next/link'
import { t } from '@/lib/content'
import { localePath, type Locale } from '@/lib/i18n'
import { LanguageSwitch } from '@/components/language-switch'

export function SiteHeader({ locale, path = '/' }: { locale: Locale; path?: string }) {
  const c = t(locale)
  return (
    <header className="border-b border-border/70 bg-cream/95 print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link
          href={localePath('/', locale)}
          className="flex items-center gap-3"
          aria-label={c.site.name}
        >
          <Image
            src="/CEJ_Logo.jpg"
            alt=""
            width={56}
            height={56}
            priority
            className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
          />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-xl lowercase tracking-[0.25em] text-stone">
              {c.site.name}
            </span>
            <span className="mt-1 font-display text-sm italic text-gold-deep">
              {c.site.strapline}
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 sm:gap-8">
          <Link
            href={localePath('/dine-at-home', locale)}
            className="caps text-charcoal transition-colors hover:text-gold-deep"
          >
            {c.nav.dineAtHome}
          </Link>
          <LanguageSwitch locale={locale} path={path} />
        </nav>
      </div>
    </header>
  )
}
