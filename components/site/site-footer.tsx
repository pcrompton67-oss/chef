import Link from 'next/link'
import { t, LEGAL_PAGES } from '@/lib/content'
import { localePath, type Locale } from '@/lib/i18n'
import { LEGAL_PATHS } from '@/lib/site'

export function SiteFooter({ locale }: { locale: Locale }) {
  const c = t(locale)
  return (
    <footer className="border-t border-border/70 bg-cream px-4 py-14 text-center print:hidden">
      <p className="font-display text-2xl lowercase tracking-[0.3em] text-stone">
        {c.site.name}
      </p>
      <p className="mt-1 font-display text-base italic text-gold-deep">
        {c.site.strapline}
      </p>
      <span className="rule my-6" aria-hidden />
      <nav className="mb-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs tracking-wider">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page}
            href={localePath(LEGAL_PATHS[page], locale)}
            className="text-stone transition-colors hover:text-gold-deep"
          >
            {c.legal.links[page]}
          </Link>
        ))}
      </nav>
      <p className="text-xs tracking-wider text-stone">
        © {new Date().getFullYear()} {c.site.name} · {c.footer.rights}
      </p>
    </footer>
  )
}
