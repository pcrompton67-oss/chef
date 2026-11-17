import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { content } from '@/lib/content'
import { formatDate, localePath, type Locale } from '@/lib/i18n'
import { getEvent as loadEvent, listEvents } from '@/lib/events'
import { DineAtHomePage } from '@/components/dine-at-home-page'
import { EventPage } from '@/components/event-page'
import { ThankYouPage } from '@/components/thank-you-page'
import { UnsubscribeForm } from '@/components/unsubscribe-page'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { transferDepositDue } from '@/lib/orders'
import { getBusinessSettings } from '@/lib/settings'

// The page and its metadata share one database lookup per request.
const getEvent = cache(loadEvent)

// Shared by the English and French page files in app/ so each stays a few lines.

/** The Dine at Home page. `path` is "/" or "/dine-at-home" (both show the same page). */
export async function renderDineAtHome(locale: Locale, path: string) {
  const { upcoming, past } = await listEvents()
  return <DineAtHomePage locale={locale} path={path} upcoming={upcoming} past={past} />
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
  const event = await getEvent(slug)
  if (!event) notFound()
  return <EventPage event={event} locale={locale} path={`/dine-at-home/${slug}`} />
}

export async function eventMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const event = await getEvent(slug)
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

/** The page shown after ordering. `ref` is the order number from the address (digits only). */
export async function renderThankYou(locale: Locale, slug: string, ref: string | string[] | undefined) {
  const event = await getEvent(slug)
  if (!event) notFound()
  const reference = typeof ref === 'string' && /^\d{1,10}$/.test(ref) ? ref : null
  const [depositCents, settings] = reference
    ? await Promise.all([transferDepositDue(event.slug, reference), getBusinessSettings()])
    : [null, null]
  return (
    <ThankYouPage
      event={event}
      locale={locale}
      path={`/dine-at-home/${slug}/thank-you`}
      reference={reference}
      transfer={
        reference && depositCents !== null && settings
          ? { depositCents, holdDays: settings.holdDays, bank: settings }
          : null
      }
    />
  )
}

export function thankYouMetadata(locale: Locale): Metadata {
  return { title: content[locale].thanks.title, robots: { index: false } }
}

/** The unsubscribe page. `t` is the private code from the email link. */
export function renderUnsubscribe(locale: Locale, t: string | string[] | undefined) {
  const token = typeof t === 'string' && /^[0-9a-f]{32}$/.test(t) ? t : ''
  const c = content[locale].unsubscribe
  const path = token ? `/unsubscribe?t=${token}` : '/unsubscribe'
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={path} />
      <main className="flex-1 px-4 py-24 text-center sm:px-8 sm:py-32">
        <p className="caps text-gold-deep">{c.eyebrow}</p>
        <h1 className="mt-5 text-4xl uppercase tracking-[0.14em] text-charcoal sm:text-5xl">{c.title}</h1>
        <span className="rule my-10" aria-hidden />
        <UnsubscribeForm locale={locale} token={token} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

export function unsubscribeMetadata(locale: Locale): Metadata {
  return { title: content[locale].unsubscribe.metaTitle, robots: { index: false } }
}
