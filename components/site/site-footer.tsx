import { t } from '@/lib/content'
import type { Locale } from '@/lib/i18n'

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
      <p className="text-xs tracking-wider text-stone">
        © {new Date().getFullYear()} {c.site.name} · {c.footer.rights}
      </p>
    </footer>
  )
}
