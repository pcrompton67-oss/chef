import Image from 'next/image'
import Link from 'next/link'
import { t } from '@/lib/content'
import { formatDate, formatMoney, localePath, type Locale } from '@/lib/i18n'
import type { EventSummary } from '@/lib/events'
import { FadeIn } from '@/components/site/fade-in'
import { Section } from '@/components/site/section'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { buttonStyles } from '@/components/site/button-styles'
import { AvailabilityNote } from '@/components/site/availability-note'

/** The Dine at Home page: introduction, how it works, upcoming and past evenings. */
export function DineAtHomePage({
  locale,
  path,
  upcoming,
  past,
}: {
  locale: Locale
  path: string
  upcoming: EventSummary[]
  past: EventSummary[]
}) {
  const c = t(locale).dineAtHome
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={path} />

      <main className="flex-1">
        {/* Hero photo: tall on phones, a wide crop on larger screens. */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-charcoal sm:aspect-[16/9] lg:aspect-[21/9]">
          <Image
            src="/CEJ_Food2.jpg"
            alt={c.heroAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_60%]"
          />
        </div>

        {/* Introduction */}
        <section className="px-4 pb-20 pt-16 text-center sm:px-8 sm:pb-24 sm:pt-20">
          <FadeIn>
            <p className="caps text-gold-deep">{c.eyebrow}</p>
            <h1 className="mt-5 text-5xl uppercase tracking-[0.18em] text-charcoal sm:text-6xl">
              {c.title}
            </h1>
            <p className="mt-5 text-sm tracking-[0.12em] text-stone">{c.lead}</p>
          </FadeIn>
          <FadeIn delay={250}>
            <span className="rule my-10" aria-hidden />
            <div className="mx-auto max-w-xl space-y-5 font-display text-xl leading-relaxed text-charcoal sm:text-[1.4rem]">
              {c.intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* Upcoming evenings */}
        <Section tone="ivory" title={c.upcomingTitle} id="evenings">
          {upcoming.length ? (
            <ul className="mx-auto max-w-4xl space-y-16 sm:space-y-20">
              {upcoming.map((e, i) => (
                <FadeIn as="li" key={e.slug} delay={i * 150}>
                  <EventCard event={e} locale={locale} />
                </FadeIn>
              ))}
            </ul>
          ) : (
            <FadeIn>
              <p className="mx-auto max-w-md text-center font-display text-xl italic leading-relaxed text-stone">
                {c.none}
              </p>
            </FadeIn>
          )}
        </Section>

        {/* How it works */}
        <Section title={c.stepsTitle}>
          <ol className="mx-auto grid max-w-4xl gap-12 text-center sm:grid-cols-3 sm:gap-10">
            {c.steps.map((step, i) => (
              <FadeIn as="li" key={step.title} delay={i * 200}>
                <p className="font-display text-3xl text-gold-deep">{i + 1}</p>
                <p className="caps mt-4 text-charcoal">{step.title}</p>
                <span className="rule my-5 w-8" aria-hidden />
                <p className="mx-auto max-w-[16rem] text-sm leading-relaxed text-stone">
                  {step.text}
                </p>
              </FadeIn>
            ))}
          </ol>
        </Section>

        {/* Past evenings */}
        {past.length ? (
          <Section tone="ivory" title={c.pastTitle}>
            <ul className="mx-auto max-w-xl divide-y divide-border/70 border-y border-border/70">
              {past.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={localePath(`/dine-at-home/${e.slug}`, locale)}
                    className="flex flex-col items-center gap-1 py-5 text-center transition-colors hover:text-gold-deep sm:flex-row sm:justify-between sm:text-left"
                  >
                    <span className="font-display text-xl text-stone">{e.theme}</span>
                    <span className="text-xs tracking-[0.15em] text-stone/80">
                      {formatDate(e.date, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}

function EventCard({ event: e, locale }: { event: EventSummary; locale: Locale }) {
  const c = t(locale)
  const href = localePath(`/dine-at-home/${e.slug}`, locale)
  return (
    <article className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
      <Link href={href} tabIndex={-1} aria-hidden className="block overflow-hidden">
        <Image
          src={e.heroImage || '/CEJ_Food2.jpg'}
          alt=""
          width={1536}
          height={2048}
          sizes="(min-width: 640px) 45vw, 100vw"
          className="aspect-[4/5] w-full object-cover transition-transform duration-[1500ms] ease-out hover:scale-[1.03]"
        />
      </Link>
      <div className="text-center">
        {e.isTest ? (
          <p className="mb-4 text-[0.7rem] uppercase tracking-[0.25em] text-stone/70">
            {c.event.testNotice}
          </p>
        ) : null}
        <p className="caps text-gold-deep">{formatDate(e.date, locale)}</p>
        <h3 className="mt-4 text-4xl leading-tight text-charcoal sm:text-[2.6rem]">
          <Link href={href} className="transition-colors hover:text-gold-deep">
            {e.theme}
          </Link>
        </h3>
        <span className="rule my-6 w-10" aria-hidden />
        <p className="font-display text-2xl text-charcoal">
          {formatMoney(e.priceCents, locale)}{' '}
          <span className="font-sans text-sm font-light tracking-wider text-stone">
            {c.dineAtHome.perPerson}
          </span>
        </p>
        <AvailabilityNote event={e} locale={locale} className="mt-3" />
        <Link href={href} className={buttonStyles('outline', 'mt-8')}>
          {c.dineAtHome.viewMenu}
        </Link>
      </div>
    </article>
  )
}
