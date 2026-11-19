import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { after, connection } from 'next/server'
import { content } from '@/lib/content'
import { formatDate, localePath, type Locale } from '@/lib/i18n'
import { getEvent as loadEvent, listEvents } from '@/lib/events'
import { DineAtHomePage } from '@/components/dine-at-home-page'
import { EventPage } from '@/components/event-page'
import { ThankYouPage } from '@/components/thank-you-page'
import { TokenActionForm } from '@/components/token-action-page'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { MAX_DINERS, abandonCardOrder, cardOrderState, transferDepositDue } from '@/lib/orders'
import { cardPaymentsReady, checkCardPayment } from '@/lib/stripe'
import { emailCardOrderPaid } from '@/lib/emails'
import { DEFAULT_HOLD_DAYS, getBusinessSettings, getHomeImage } from '@/lib/settings'
import { LegalPage } from '@/components/legal-page'
import { LEGAL_PATHS } from '@/lib/site'
import type { LegalPageKey } from '@/lib/content'

// The page and its metadata share one database lookup per request.
const getEvent = cache((slug: string, locale: Locale) => loadEvent(slug, locale))

// Shared by the English and French page files in app/ so each stays a few lines.

/** The Dine at Home page. `path` is "/" or "/dine-at-home" (both show the same page). */
export async function renderDineAtHome(locale: Locale, path: string) {
  const [{ upcoming, past }, homeImage] = await Promise.all([
    listEvents(locale),
    // The usual photo if the setting can't be read: the page must still show.
    getHomeImage().catch(() => ''),
  ])
  return <DineAtHomePage locale={locale} path={path} upcoming={upcoming} past={past} homeImage={homeImage} />
}

export function dineAtHomeMetadata(locale: Locale): Metadata {
  const c = content[locale]
  return {
    title: { absolute: `${c.dineAtHome.metaTitle} · ${c.site.title}` },
    description: c.site.description,
    alternates: {
      canonical: localePath('/dine-at-home', locale),
      languages: { en: '/dine-at-home', fr: '/fr/dine-at-home' },
    },
  }
}

export async function renderEvent(locale: Locale, slug: string) {
  const event = await getEvent(slug, locale)
  if (!event) notFound()
  return <EventPage event={event} locale={locale} path={`/dine-at-home/${slug}`} cardPayments={cardPaymentsReady()} />
}

export async function eventMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const event = await getEvent(slug, locale)
  if (!event) return {}
  const c = content[locale]
  const title = `${event.theme} · ${formatDate(event.date, locale)}`
  const description = event.intro || c.site.description
  return {
    title,
    description,
    alternates: {
      canonical: localePath(`/dine-at-home/${slug}`, locale),
      languages: { en: `/dine-at-home/${slug}`, fr: `/fr/dine-at-home/${slug}` },
    },
    openGraph: {
      title,
      description,
      images: event.heroImage ? [{ url: event.heroImage }] : undefined,
    },
  }
}

/** What the thank-you page's address can carry. */
export type ThankYouQuery = {
  /** The order number (digits only). */
  ref?: string | string[]
  /** Back from a paid card payment: Stripe's payment page id (issue #14). */
  session?: string | string[]
  /** "cancelled": back from Stripe's payment page without paying. */
  payment?: string | string[]
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

/** The page shown after ordering. */
export async function renderThankYou(locale: Locale, slug: string, q: ThankYouQuery) {
  const event = await getEvent(slug, locale)
  if (!event) notFound()
  const reference = /^\d{1,10}$/.test(one(q.ref)) ? one(q.ref) : null

  // A card order: confirm it if Stripe says it's paid (in case the webhook is
  // slow), or release its places straight away if the customer came back without paying.
  let card = reference ? await cardOrderState(event.slug, reference) : null
  if (reference && card === 'pending') {
    if (one(q.payment) === 'cancelled') {
      await abandonCardOrder(reference)
      card = 'unpaid'
    } else if (one(q.session)) {
      const { confirmedNow } = await checkCardPayment(one(q.session))
      if (confirmedNow) after(() => emailCardOrderPaid(confirmedNow))
      card = await cardOrderState(event.slug, reference)
    }
  }

  const [depositCents, settings] =
    reference && !card
      ? await Promise.all([transferDepositDue(event.slug, reference), getBusinessSettings()])
      : [null, null]
  return (
    <ThankYouPage
      event={event}
      locale={locale}
      // The language switch keeps the order number, so the bank details still show.
      path={`/dine-at-home/${slug}/thank-you${reference ? `?ref=${reference}` : ''}`}
      reference={reference}
      card={card}
      transfer={
        reference && depositCents !== null && settings
          ? { depositCents, holdDays: settings.holdDays, bank: settings }
          : null
      }
    />
  )
}

export function thankYouMetadata(locale: Locale, q: ThankYouQuery): Metadata {
  const c = content[locale].thanks
  return { title: one(q.payment) === 'cancelled' ? c.card.unpaidTitle : c.title, robots: { index: false } }
}

/**
 * The pages reached from email links (issue #10): unsubscribing and confirming
 * a sign-up. `t` is the private code from the link.
 */
function renderTokenPage(locale: Locale, t: string | string[] | undefined, page: 'unsubscribe' | 'confirmSignup') {
  const token = typeof t === 'string' && /^[0-9a-f]{32}$/.test(t) ? t : ''
  const c = content[locale][page]
  const base = page === 'unsubscribe' ? '/unsubscribe' : '/confirm-subscription'
  const path = token ? `${base}?t=${token}` : base
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={path} />
      <main className="flex-1 px-4 py-24 text-center sm:px-8 sm:py-32">
        <p className="caps text-gold-deep">{c.eyebrow}</p>
        <h1 className="mt-5 text-4xl uppercase tracking-[0.14em] text-charcoal sm:text-5xl">{c.title}</h1>
        <span className="rule my-10" aria-hidden />
        <TokenActionForm locale={locale} token={token} endpoint={`/api${base}`} c={c} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

export function renderUnsubscribe(locale: Locale, t: string | string[] | undefined) {
  return renderTokenPage(locale, t, 'unsubscribe')
}

export function unsubscribeMetadata(locale: Locale): Metadata {
  return { title: content[locale].unsubscribe.metaTitle, robots: { index: false } }
}

export function renderConfirmSignup(locale: Locale, t: string | string[] | undefined) {
  return renderTokenPage(locale, t, 'confirmSignup')
}

export function confirmSignupMetadata(locale: Locale): Metadata {
  return { title: content[locale].confirmSignup.metaTitle, robots: { index: false } }
}

/** The legal pages (issue #11): legal notice, privacy, allergens, booking terms. */
export async function renderLegal(locale: Locale, page: LegalPageKey) {
  // The booking terms quote the days allowed to pay; fall back to the default
  // if the database can't be reached, so the page always shows. Read on each
  // visit (not when the site is built) so a change in Settings shows straight away.
  await connection()
  const holdDays = await getBusinessSettings()
    .then((s) => s.holdDays)
    .catch(() => DEFAULT_HOLD_DAYS)
  return (
    <LegalPage
      locale={locale}
      page={page}
      values={{ holdDays, maxDiners: MAX_DINERS, cardPayments: cardPaymentsReady() }}
    />
  )
}

export function legalMetadata(locale: Locale, page: LegalPageKey): Metadata {
  const path = LEGAL_PATHS[page]
  return {
    title: content[locale].legal.pages[page].metaTitle,
    alternates: { canonical: localePath(path, locale), languages: { en: path, fr: `/fr${path}` } },
  }
}
