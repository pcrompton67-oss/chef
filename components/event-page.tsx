import Image from 'next/image'
import Link from 'next/link'
import { t, type TastingMenu as Menu } from '@/lib/content'
import {
  formatDate,
  formatMoney,
  formatParisDay,
  formatTime,
  localePath,
  type Locale,
} from '@/lib/i18n'
import type { EventDetail } from '@/lib/events'
import { FadeIn } from '@/components/site/fade-in'
import { Section } from '@/components/site/section'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { TastingMenu } from '@/components/site/tasting-menu'
import { buttonStyles } from '@/components/site/button-styles'
import { AvailabilityNote } from '@/components/site/availability-note'
import { OrderForm } from '@/components/order-form'
import { NotifyForm } from '@/components/notify-form'
import { MAX_DINERS } from '@/lib/orders'

/** One Dine at Home evening: photo, menu, price, collection times and the order form. */
export function EventPage({
  event: e,
  locale,
  path,
  cardPayments,
}: {
  event: EventDetail
  locale: Locale
  path: string
  /** Whether the order form offers paying the deposit by card (Stripe set up, issue #14). */
  cardPayments: boolean
}) {
  const c = t(locale).event
  const price = formatMoney(e.priceCents, locale)

  const menu: Menu = {
    eyebrow: c.eyebrow,
    // "Friday 4 December" / "Vendredi 4 décembre", as on her printed menus
    date: formatDate(e.date, locale, false).replace(',', ''),
    title: e.theme,
    courses: e.courses.map((course) => ({
      dishes: course.options.map((o) => (o.vegetarian ? `${o.name} ${c.vegetarian}` : o.name)),
      components: course.description
        ? course.description.split('·').map((s) => s.trim()).filter(Boolean)
        : [],
    })),
    price: `${price} ${c.perPerson}`,
    notes: [c.courseCount(e.courses.length), ...c.menuNotes],
    footnote: c.videoNote,
  }

  const closedNote =
    e.availability === 'sold_out'
      ? c.soldOutNote
      : e.availability === 'closed'
        ? c.closedNote
        : e.availability === 'past'
          ? c.pastNote
          : null

  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={path} />

      <main className="flex-1">
        {/* Hero photo */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-charcoal sm:aspect-[16/9] lg:aspect-[21/9]">
          <Image
            src={e.heroImage || '/CEJ_Food2.jpg'}
            alt={c.heroAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_60%]"
          />
        </div>

        {/* Theme, date and introduction */}
        <section className="px-4 pb-16 pt-10 text-center sm:px-8 sm:pb-20 sm:pt-12">
          <div className="mx-auto max-w-5xl text-left">
            <Link
              href={localePath('/dine-at-home', locale)}
              className="caps text-stone transition-colors hover:text-gold-deep"
            >
              ← {c.back}
            </Link>
          </div>
          <FadeIn className="mt-12 sm:mt-14">
            {e.isTest ? (
              <p className="mb-6 text-[0.7rem] uppercase tracking-[0.25em] text-stone/70">
                {c.testNotice}
              </p>
            ) : null}
            <p className="caps text-gold-deep">{c.eyebrow}</p>
            <h1 className="mt-5 text-5xl leading-tight text-charcoal sm:text-6xl">{e.theme}</h1>
            <p className="caps mt-6 text-charcoal">{formatDate(e.date, locale)}</p>
          </FadeIn>
          <FadeIn delay={250}>
            <span className="rule my-10" aria-hidden />
            {e.intro ? (
              <p className="mx-auto max-w-xl font-display text-xl italic leading-relaxed text-charcoal sm:text-2xl">
                {e.intro}
              </p>
            ) : null}
          </FadeIn>
        </section>

        {/* The menu, laid out like her printed menus */}
        <Section tone="ivory" id="menu">
          <TastingMenu menu={menu} locale={locale} />
          {e.menuImage ? (
            <FadeIn className="mt-10 text-center">
              <a
                href={e.menuImage}
                target="_blank"
                rel="noopener"
                className={buttonStyles('text')}
              >
                {c.printedMenu}
              </a>
            </FadeIn>
          ) : null}
        </Section>

        {/* Price, places and collection times (never addresses) */}
        <Section>
          <div className="mx-auto grid max-w-4xl items-center gap-14 sm:grid-cols-2 sm:gap-16">
            <FadeIn className="order-2 sm:order-1">
              <Image
                src="/CEF_Food1.jpg"
                alt={c.secondImageAlt}
                width={1450}
                height={1934}
                sizes="(min-width: 640px) 45vw, 100vw"
                className="aspect-[4/5] w-full object-cover"
              />
            </FadeIn>

            <div className="order-1 space-y-14 text-center sm:order-2">
              <FadeIn>
                <p className="caps text-gold-deep">{c.detailsTitle}</p>
                <span className="rule my-6 w-10" aria-hidden />
                <p className="font-display text-4xl text-charcoal">
                  {price}{' '}
                  <span className="font-sans text-sm font-light tracking-wider text-stone">
                    {c.perPerson}
                  </span>
                </p>
                <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-stone">
                  {c.deposit(formatMoney(e.depositCents, locale))}
                </p>
                {e.availability === 'open' ? (
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone">
                    {c.orderBy(formatParisDay(e.cutoffAt, locale))}
                  </p>
                ) : null}
                <AvailabilityNote event={e} locale={locale} className="mt-6" />
              </FadeIn>

              {e.collectionPoints.length ? (
                <FadeIn delay={200}>
                  <p className="caps text-gold-deep">{c.collectionTitle}</p>
                  <span className="rule my-6 w-10" aria-hidden />
                  <ul className="mx-auto max-w-xs space-y-3">
                    {e.collectionPoints.map((p) => (
                      <li
                        key={`${p.place}-${p.time}`}
                        className="flex items-baseline gap-3 font-display text-xl text-charcoal"
                      >
                        <span>{p.place}</span>
                        <span className="mb-1 flex-1 border-b border-dotted border-stone/40" aria-hidden />
                        <span className="tabular-nums">{formatTime(p.time, locale)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mx-auto mt-6 max-w-xs text-sm leading-relaxed text-stone">
                    {c.collectionNote}
                  </p>
                </FadeIn>
              ) : null}
            </div>
          </div>
        </Section>

        {/* Order form, or why ordering isn't possible */}
        <Section tone="ivory" id="order" title={closedNote ? undefined : c.orderTitle}>
          {closedNote ? (
            <FadeIn className="space-y-16">
              <p className="mx-auto max-w-md text-center font-display text-xl italic leading-relaxed text-stone">
                {closedNote}
              </p>
              {e.availability === 'sold_out' ? <NotifyForm locale={locale} eventSlug={e.slug} /> : null}
            </FadeIn>
          ) : (
            <OrderForm
              event={e}
              locale={locale}
              maxDiners={Math.min(MAX_DINERS, e.placesLeft)}
              cardPayments={cardPayments && e.depositCents > 0}
            />
          )}
        </Section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}
