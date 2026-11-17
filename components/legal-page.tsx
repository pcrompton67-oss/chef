import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { t, LEGAL_UPDATED, type LegalPageKey } from '@/lib/content'
import { dateLocale, localePath, type Locale } from '@/lib/i18n'
import { BUSINESS, LEGAL_PATHS, WEB_HOST, type BusinessField } from '@/lib/site'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { FadeIn } from '@/components/site/fade-in'

/** Numbers the wording can mention, read from the settings when the page is shown. */
export type LegalValues = { holdDays: number; maxDiners: number; cardPayments: boolean }

/** Wording marked {ifCard} shows only with card payments on, {ifNoCard} only with them off. */
function shown(text: string, values: LegalValues): boolean {
  if (text.startsWith('{ifCard}')) return values.cardPayments
  if (text.startsWith('{ifNoCard}')) return !values.cardPayments
  return true
}

/** One legal page (issue #11): mentions légales, privacy, allergens or booking terms. */
export function LegalPage({ locale, page, values }: { locale: Locale; page: LegalPageKey; values: LegalValues }) {
  const c = t(locale).legal
  const p = c.pages[page]
  const fill = (text: string) => fillText(text.replace(/^\{if(No)?Card\}/, ''), locale, values)
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={LEGAL_PATHS[page]} />
      <main className="flex-1 px-4 py-20 sm:px-8 sm:py-28">
        <FadeIn className="text-center">
          <p className="caps text-gold-deep">{p.eyebrow}</p>
          <h1 className="mt-5 text-4xl uppercase tracking-[0.14em] text-charcoal sm:text-5xl">{p.title}</h1>
          <span className="rule my-10" aria-hidden />
        </FadeIn>
        <FadeIn className="mx-auto max-w-2xl text-base leading-relaxed text-charcoal">
          {p.intro.map((text, i) => (
            <p key={i} className="mb-5 font-display text-xl leading-relaxed">
              {fill(text)}
            </p>
          ))}
          {p.sections.map((s) => (
            <section key={s.heading} className="mt-12">
              <h2 className="caps mb-5 text-center text-gold-deep">{s.heading}</h2>
              <div className="space-y-4">
                {s.body
                  .filter((item) => Array.isArray(item) || shown(item, values))
                  .map((item, i) =>
                  Array.isArray(item) ? (
                    <ul key={i} className="space-y-2 border-l border-gold/50 pl-5">
                      {item.filter((li) => shown(li, values)).map((li, j) => (
                        <li key={j}>{fill(li)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{fill(item)}</p>
                  ),
                )}
              </div>
            </section>
          ))}
          <p className="mt-16 text-center text-xs tracking-wider text-stone">
            {c.updated} · {formatDay(LEGAL_UPDATED, locale)}
          </p>
        </FadeIn>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

/** Wording Eleanor still has to supply, highlighted so it's easy to spot. */
function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="bg-gold/20 px-1 text-gold-deep">[{children}]</mark>
}

/** Turns the wording's {tokens} and [[placeholders]] into text and links. */
function fillText(text: string, locale: Locale, values: LegalValues): ReactNode {
  const c = t(locale).legal
  return text.split(/(\{[a-zA-Z:]+\}|\[\[[^\]]+\]\])/).map((part, i) => {
    if (part.startsWith('[[')) return <Placeholder key={i}>{part.slice(2, -2)}</Placeholder>
    if (!part.startsWith('{')) return <Fragment key={i}>{part}</Fragment>
    const token = part.slice(1, -1)
    if (token.startsWith('link:')) {
      const page = token.slice(5) as LegalPageKey
      return (
        <Link key={i} href={localePath(LEGAL_PATHS[page], locale)} className="border-b border-gold text-charcoal hover:text-gold-deep">
          {c.inText[page]}
        </Link>
      )
    }
    if (token === 'host') return <Fragment key={i}>{WEB_HOST}</Fragment>
    if (token === 'holdDays') return <Fragment key={i}>{values.holdDays}</Fragment>
    if (token === 'maxDiners') return <Fragment key={i}>{values.maxDiners}</Fragment>
    if (token in BUSINESS) {
      const field = token as BusinessField
      const value: string | null = BUSINESS[field]
      return value ? <Fragment key={i}>{value}</Fragment> : <Placeholder key={i}>{c.missing(c.fields[field])}</Placeholder>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

/** A YYYY-MM-DD date as "17 November 2026" / "17 novembre 2026". */
function formatDay(date: string, locale: Locale): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
