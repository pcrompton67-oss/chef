import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { content } from '@/lib/content'
import { localePath, type Locale } from '@/lib/i18n'
import { buttonStyles } from '@/components/site/button-styles'

// The page for an address that doesn't exist (or an evening that isn't
// published). It can't tell which language the visitor wanted, so it speaks
// both (issue #12). Wording in lib/content.ts (`notFound`).

export const metadata: Metadata = {
  title: `${content.en.notFound.eyebrow} · ${content.fr.notFound.eyebrow}`,
  robots: { index: false },
}

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-20 text-center sm:px-8 sm:py-28">
      <Link href="/" aria-label={content.en.site.name}>
        <Image src="/CEJ_Logo.jpg" alt="" width={88} height={88} className="h-20 w-20 rounded-full" />
      </Link>
      {(['en', 'fr'] as Locale[]).map((locale, i) => {
        const c = content[locale].notFound
        return (
          <section key={locale} lang={locale} className={i ? 'mt-4' : 'mt-14'}>
            {i ? <span className="rule mb-14" aria-hidden /> : null}
            <p className="caps text-gold-deep">{c.eyebrow}</p>
            <h1 className="mt-5 text-4xl uppercase tracking-[0.14em] text-charcoal sm:text-5xl">{c.title}</h1>
            <p className="mt-6 text-stone">{c.text}</p>
            <Link href={localePath('/dine-at-home', locale)} className={buttonStyles('text', 'mt-8')}>
              {c.back}
            </Link>
          </section>
        )
      })}
    </main>
  )
}
