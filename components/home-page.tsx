import Image from 'next/image'
import { t } from '@/lib/content'
import type { Locale } from '@/lib/i18n'
import { FadeIn } from '@/components/site/fade-in'
import { Section } from '@/components/site/section'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { TastingMenu } from '@/components/site/tasting-menu'
import { buttonStyles } from '@/components/site/button-styles'

// Placeholder home page: shows the brand pieces until the real pages are built.
export function HomePage({ locale }: { locale: Locale }) {
  const c = t(locale)
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 pb-20 pt-16 text-center sm:px-8 sm:pb-28 sm:pt-24">
          <FadeIn>
            <Image
              src="/CEJ_Logo.jpg"
              alt=""
              width={220}
              height={220}
              priority
              className="mx-auto h-40 w-40 rounded-full sm:h-52 sm:w-52"
            />
          </FadeIn>
          <FadeIn delay={200}>
            <p className="caps mt-10 text-gold-deep">{c.home.heroEyebrow}</p>
            <h1 className="mt-4 text-5xl lowercase tracking-[0.18em] text-stone sm:text-7xl">
              {c.home.heroTitle}
            </h1>
          </FadeIn>
          <FadeIn delay={400}>
            <span className="rule my-8" aria-hidden />
            <p className="mx-auto max-w-md text-balance font-display text-xl italic leading-relaxed text-charcoal sm:text-2xl">
              {c.home.heroLead}
            </p>
            <a href="#menu" className={buttonStyles('outline', 'mt-10')}>
              {c.home.heroCta}
            </a>
          </FadeIn>
        </section>

        {/* Intro with photos */}
        <Section tone="ivory" title={c.home.introTitle}>
          <FadeIn className="mx-auto max-w-xl text-center leading-loose text-stone">
            <p>{c.home.introBody}</p>
          </FadeIn>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 sm:gap-8">
            <FadeIn>
              <Image
                src="/CEF_Food1.jpg"
                alt={c.home.imageAlt1}
                width={1450}
                height={1934}
                sizes="(min-width: 640px) 50vw, 100vw"
                className="aspect-[4/5] w-full object-cover"
              />
            </FadeIn>
            <FadeIn delay={200}>
              <Image
                src="/CEJ_Food2.jpg"
                alt={c.home.imageAlt2}
                width={1536}
                height={2048}
                sizes="(min-width: 640px) 50vw, 100vw"
                className="aspect-[4/5] w-full object-cover"
              />
            </FadeIn>
          </div>
        </Section>

        {/* Sample tasting menu */}
        <Section id="menu" title={c.home.menuSectionTitle}>
          <TastingMenu menu={c.sampleMenu} locale={locale} />
        </Section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}
