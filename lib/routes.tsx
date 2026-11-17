import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { content } from '@/lib/content'
import { formatDate, localePath, type Locale } from '@/lib/i18n'
import { getEvent as loadEvent, listEvents } from '@/lib/events'
import { DineAtHomePage } from '@/components/dine-at-home-page'
import { EventPage } from '@/components/event-page'
import { ThankYouPage } from '@/components/thank-you-page'

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
  return (
    <ThankYouPage
      event={event}
      locale={locale}
      path={`/dine-at-home/${slug}/thank-you`}
      reference={reference}
    />
  )
}

export function thankYouMetadata(locale: Locale): Metadata {
  return { title: content[locale].thanks.title, robots: { index: false } }
}
