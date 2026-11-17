import Link from 'next/link'
import { t } from '@/lib/content'
import { formatDate, localePath, type Locale } from '@/lib/i18n'
import type { EventDetail } from '@/lib/events'
import { FadeIn } from '@/components/site/fade-in'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { buttonStyles } from '@/components/site/button-styles'

/** Shown after an order is placed: what happens next. */
export function ThankYouPage({
  event: e,
  locale,
  path,
  reference,
}: {
  event: EventDetail
  locale: Locale
  path: string
  reference: string | null
}) {
  const c = t(locale).thanks
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={path} />
      <main className="flex-1 px-4 py-24 text-center sm:px-8 sm:py-32">
        <FadeIn>
          <p className="caps text-gold-deep">{c.eyebrow}</p>
          <h1 className="mt-5 text-4xl uppercase tracking-[0.14em] text-charcoal sm:text-5xl">
            {c.title}
          </h1>
          <p className="mt-6 font-display text-xl italic text-stone">
            {e.theme} · {formatDate(e.date, locale)}
          </p>
          {reference ? (
            <p className="mt-3 text-sm tracking-[0.12em] text-stone">{c.reference(reference)}</p>
          ) : null}
        </FadeIn>
        <FadeIn delay={250}>
          <span className="rule my-10" aria-hidden />
          <div className="mx-auto max-w-md space-y-5 font-display text-xl leading-relaxed text-charcoal">
            {c.text.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <Link
            href={localePath(`/dine-at-home/${e.slug}`, locale)}
            className={buttonStyles('outline', 'mt-12')}
          >
            {c.back}
          </Link>
        </FadeIn>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
