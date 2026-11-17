import Link from 'next/link'
import { sql } from '@/lib/db'
import { listHeroPhotos, type GalleryPhoto } from '@/lib/gallery'
import {
  HOME_UPCOMING_DELIVERIES,
  formatUpcoming,
  listUpcomingDeliveries,
  type UpcomingDelivery,
} from '@/lib/upcoming'
import { getVisibleBanner } from '@/lib/banner'
import { AnnouncementBanner } from '@/components/announcement-banner'
import { LanguageSwitch } from '@/components/language-switch'
import { dateLocale, dayName, localePath, type Locale } from '@/lib/i18n'
import { SignupBox } from '@/features/customers/signup-box'
import {
  DELIVERY_DAYS,
  deliveryDateFor,
  deliveryRangeFor,
  formatShortDate,
  isOrderingOpen,
  type Menu,
  type Village,
} from '@/lib/types'

// Static class names so Tailwind keeps them. Four days go 2-up on tablets and
// 4-up on desktop; three days 3-up on desktop.
const ROUTE_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

const TEXT = {
  en: {
    handcrafted: 'Handcrafted in Valence-en-Poitou',
    tagline: 'We make, you discover',
    logoAlt: 'Magnificent Sausage Rolls & Sausages — windmill logo',
    nowTaking: 'Now taking orders for delivery on',
    orderCta: 'Order for this delivery',
    ordersClose: 'Orders close',
    openSoonFor: (when: string) => `Orders open soon for ${when}`,
    openSoonNext: 'Orders open soon for our next delivery',
    then: 'Then',
    nextDeliveries: 'Next deliveries',
    steps: [
      {
        title: 'Choose your flavours',
        body: 'A wide range of sausage and sausage roll flavours, seasonal offerings, gluten-free options and breakfast patties.',
      },
      {
        title: 'Order before the cutoff',
        body: 'We make to order, so we need your order in by the Friday before delivery. Pay on the day — cash or cheque.',
      },
      {
        title: 'Meet us in your town',
        body: 'We drive a Friday and a Saturday route (with the odd extra day) across the Vienne, Charente and Deux-Sèvres. Pick the stop nearest you.',
      },
    ],
    photos: 'Photos',
    allPhotos: 'See all photos →',
    dropOffTowns: 'Drop-off towns',
    timesApprox:
      'Times are approximate — we visit around ten towns a day, so we may be a little early or late.',
    goodToKnow: 'Good to know',
    goodToKnowItems: [
      'Sausage rolls are sold in packs of 4. Sausages are sold in packs of 6. Gluten-free options are the same price as regular.',
      'Everything is delivered individually frozen, ready to cook straight from the freezer.',
      'Products come with labels for ingredients, cooking and storage instructions.',
      'Payment is cash or cheque at your drop-off point.',
    ],
    gallery: 'Photo gallery',
    dataPolicy: 'Data-use policy',
    ownerLogin: 'Owner login',
  },
  fr: {
    handcrafted: 'Fait main à Valence-en-Poitou',
    tagline: 'Nous fabriquons, vous découvrez',
    logoAlt: 'Magnificent Sausage Rolls & Sausages — logo au moulin',
    nowTaking: 'Commandes ouvertes pour la livraison du',
    orderCta: 'Commander pour cette livraison',
    ordersClose: 'Fin des commandes :',
    openSoonFor: (when: string) => `Commandes bientôt ouvertes pour le ${when}`,
    openSoonNext: 'Commandes bientôt ouvertes pour notre prochaine livraison',
    then: 'Ensuite',
    nextDeliveries: 'Prochaines livraisons',
    steps: [
      {
        title: 'Choisissez vos saveurs',
        body: 'Un large choix de saucisses et de sausage rolls (friands à la saucisse), des recettes de saison, des options sans gluten et des galettes de saucisse pour le petit-déjeuner.',
      },
      {
        title: 'Commandez avant la date limite',
        body: 'Nous fabriquons à la commande : merci de commander au plus tard le vendredi précédant la livraison. Paiement le jour même, en espèces ou par chèque.',
      },
      {
        title: 'Retrouvez-nous près de chez vous',
        body: 'Nous faisons une tournée le vendredi et le samedi (et parfois un jour de plus) dans la Vienne, la Charente et les Deux-Sèvres. Choisissez l’arrêt le plus proche.',
      },
    ],
    photos: 'Photos',
    allPhotos: 'Voir toutes les photos →',
    dropOffTowns: 'Points de retrait',
    timesApprox:
      'Les horaires sont approximatifs : nous passons dans une dizaine de villes par jour, nous pouvons donc avoir un peu d’avance ou de retard.',
    goodToKnow: 'Bon à savoir',
    goodToKnowItems: [
      'Les sausage rolls (friands à la saucisse) sont vendus par 4. Les saucisses sont vendues par 6. Les options sans gluten sont au même prix.',
      'Tout est livré surgelé individuellement, prêt à cuire directement depuis le congélateur.',
      'Chaque produit est étiqueté avec les ingrédients et les instructions de cuisson et de conservation.',
      'Paiement en espèces ou par chèque au point de retrait.',
    ],
    gallery: 'Galerie photos',
    dataPolicy: 'Politique d’utilisation des données',
    ownerLogin: 'Espace gérant',
  },
} as const

async function getActiveMenu(): Promise<Menu | null> {
  const [menu] = await sql`
    SELECT id, name, sale_date, sale_date_end, cutoff_at, orders_open, is_active
    FROM menus WHERE is_active = true ORDER BY id DESC LIMIT 1
  `
  return (menu as Menu | undefined) ?? null
}

async function getVillages(): Promise<Village[]> {
  const rows = await sql`
    SELECT id, name, pickup_time, delivery_day, sort_order, is_active
    FROM villages
    WHERE is_active = true
      AND menu_id = (SELECT id FROM menus WHERE is_active = true LIMIT 1)
    ORDER BY CASE delivery_day WHEN 'Thursday' THEN 1 WHEN 'Friday' THEN 2 WHEN 'Saturday' THEN 3 WHEN 'Sunday' THEN 4 ELSE 5 END,
             sort_order ASC, lower(name) ASC
  `
  return rows as Village[]
}

function formatCutoff(cutoff: string | null, locale: Locale): string {
  if (!cutoff) return ''
  return new Date(cutoff).toLocaleString(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

export async function HomePage({ locale }: { locale: Locale }) {
  const t = TEXT[locale]
  const [active, villages, heroPhotos, upcoming, banner] = await Promise.all([
    getActiveMenu(),
    getVillages(),
    // A photo hiccup should never take the order page offline.
    listHeroPhotos().catch((): GalleryPhoto[] => []),
    listUpcomingDeliveries(HOME_UPCOMING_DELIVERIES + 2).catch((): UpcomingDelivery[] => []),
    getVisibleBanner().catch(() => null),
  ])
  const open = isOrderingOpen(active)
  const range = deliveryRangeFor(
    active,
    villages.map((v) => v.delivery_day),
    locale,
  )
  // Once the cutoff has passed, the active menu's delivery is no longer
  // orderable, so point customers at the next planned delivery instead.
  const cutoffPassed =
    !!active?.cutoff_at && new Date(active.cutoff_at).getTime() <= Date.now()
  // The "Next deliveries" list keeps a delivery until its last day is over, so
  // skip any entry on or before this delivery's last day (it is the same run).
  const lastDay = active ? active.sale_date_end ?? active.sale_date : null
  const activeLastDay = !lastDay
    ? ''
    : (lastDay as unknown) instanceof Date
      ? (lastDay as unknown as Date).toISOString().slice(0, 10)
      : String(lastDay).slice(0, 10)
  const laterUpcoming = cutoffPassed
    ? upcoming.filter((d) => d.start_date > activeLastDay)
    : upcoming
  const nextPlanned = !open && cutoffPassed ? laterUpcoming[0] ?? null : null
  const closedHeadline = open
    ? ''
    : cutoffPassed
      ? nextPlanned
        ? t.openSoonFor(formatUpcoming(nextPlanned.start_date, nextPlanned.end_date, locale))
        : t.openSoonNext
      : range
        ? t.openSoonFor(range)
        : t.openSoonNext
  const upcomingList = (nextPlanned ? laterUpcoming.slice(1) : laterUpcoming).slice(
    0,
    HOME_UPCOMING_DELIVERIES,
  )
  const cutoff = formatCutoff(active?.cutoff_at ?? null, locale)
  const routeDays = DELIVERY_DAYS.map((day) => ({
    day,
    villages: villages.filter((v) => v.delivery_day === day),
  })).filter((d) => d.villages.length > 0)
  const routeGridCols =
    ROUTE_GRID_COLS[Math.min(routeDays.length, 4)] ?? ROUTE_GRID_COLS[2]

  return (
    <main lang={locale} className="flex min-h-dvh flex-col">
      {banner ? <AnnouncementBanner banner={banner} /> : null}
      {/* Hero — the logo's own green block, with the windmill mark as the signature element. */}
      <section className="bg-brand-green text-brand-yellow">
        <div className="mx-auto flex max-w-5xl justify-end px-5 pt-4">
          <LanguageSwitch locale={locale} path="/" />
        </div>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-5 pb-14 pt-6 text-center sm:pb-20 sm:pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt={t.logoAlt}
            className="h-52 w-52 rounded-full object-cover ring-4 ring-brand-yellow/60 sm:h-64 sm:w-64"
          />
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-yellow/80">
              {t.handcrafted}
            </p>
            <h1 className="max-w-3xl text-balance font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
              Magnificent Sausage Rolls &amp; Sausages
            </h1>
            <p className="font-display text-xl italic text-brand-cream/90 sm:text-2xl">
              {t.tagline}
            </p>
          </div>

          {open ? (
            <div className="flex w-full max-w-md flex-col items-center gap-4">
              {range ? (
                <p className="text-pretty text-base text-brand-cream">
                  {t.nowTaking}{' '}
                  <span className="font-bold text-brand-yellow">{range}</span>
                </p>
              ) : null}
              <Link
                href={localePath('/order', locale)}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-brand-yellow px-6 py-4 font-display text-xl font-bold text-brand-green-dark transition-colors hover:bg-brand-cream"
              >
                {t.orderCta}
                <span aria-hidden className="text-2xl leading-none">
                  →
                </span>
              </Link>
              {cutoff ? (
                <p className="text-sm text-brand-cream/80">
                  {t.ordersClose} {cutoff}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-md border border-brand-yellow/40 px-6 py-6">
              <p className="text-balance font-display text-2xl font-bold">
                {closedHeadline}
              </p>
            </div>
          )}

          {upcomingList.length > 0 ? (
            <section
              aria-labelledby="next-deliveries"
              className="flex w-full max-w-md flex-col items-center gap-3 border-t border-brand-yellow/30 pt-6"
            >
              <h2
                id="next-deliveries"
                className="text-xs font-bold uppercase tracking-[0.3em] text-brand-yellow/80"
              >
                {nextPlanned ? t.then : t.nextDeliveries}
              </h2>
              <ul className="flex flex-col items-center gap-1.5">
                {upcomingList.map((d) => (
                  <li key={d.id} className="text-pretty text-base text-brand-cream">
                    {formatUpcoming(d.start_date, d.end_date, locale)}
                    {d.note ? (
                      <span className="text-brand-cream/70">{` · ${d.note}`}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <SignupBox locale={locale} />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-14">
        <div className="grid gap-8 sm:grid-cols-3">
          {t.steps.map((step) => (
            <div key={step.title} className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-bold text-brand-green">
                {step.title}
              </h2>
              <p className="text-pretty leading-relaxed text-brand-dark/75">
                {step.body}
              </p>
            </div>
          ))}
        </div>

        {heroPhotos.length > 0 ? (
          <section aria-label={t.photos} className="flex flex-col gap-3">
            <div className="flex flex-wrap justify-center gap-3">
              {heroPhotos.map((photo) => (
                <figure
                  key={photo.id}
                  className="relative w-[calc(50%-0.375rem)] overflow-hidden rounded-md border border-border sm:w-44 md:w-48"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Magnificent Sausage Rolls & Sausages'}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  {photo.caption ? (
                    <figcaption className="absolute inset-x-0 bottom-0 truncate bg-brand-green-dark/80 px-2 py-1 text-xs text-brand-cream">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
            <Link
              href="/gallery"
              className="self-center text-sm font-bold text-brand-green underline-offset-4 hover:underline"
            >
              {t.allPhotos}
            </Link>
          </section>
        ) : null}

        {/* Delivery route */}
        {villages.length > 0 ? (
          <div className="flex flex-col gap-6 rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-bold text-brand-green">
                {t.dropOffTowns}
              </h2>
              <p className="text-sm text-brand-dark/65">{t.timesApprox}</p>
            </div>
            <div className={`grid gap-8 ${routeGridCols}`}>
              {routeDays.map(({ day, villages: dayVillages }) => (
                <RouteColumn
                  key={day}
                  day={dayName(day, locale)}
                  villages={dayVillages}
                  dateText={formatShortDate(deliveryDateFor(active, day), locale)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-md bg-brand-green-dark p-6 text-brand-cream sm:p-8">
          <h2 className="font-display text-xl font-bold text-brand-yellow">
            {t.goodToKnow}
          </h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-brand-cream/90">
            {t.goodToKnowItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-5 pb-10 text-center text-xs text-brand-dark/55">
        <p>
          Magnificent Sausage Rolls &amp; Sausages · Valence-en-Poitou 86700 ·
          Siret 90507449800015
        </p>
        <a
          href="mailto:magnificentsausagerolls@yahoo.com"
          className="underline-offset-2 hover:text-brand-green hover:underline"
        >
          magnificentsausagerolls@yahoo.com
        </a>
        <Link
          href="/gallery"
          className="underline-offset-2 transition-colors hover:text-brand-green hover:underline"
        >
          {t.gallery}
        </Link>
        <Link
          href="/data-policy"
          className="underline-offset-2 transition-colors hover:text-brand-green hover:underline"
        >
          {t.dataPolicy}
        </Link>
        <Link
          href="/manager"
          className="font-bold uppercase tracking-wide text-brand-dark/40 transition-colors hover:text-brand-green"
        >
          {t.ownerLogin}
        </Link>
      </footer>
    </main>
  )
}

function RouteColumn({
  day,
  villages,
  dateText,
}: {
  day: string
  villages: Village[]
  dateText: string
}) {
  if (villages.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-baseline gap-2 border-b-2 border-brand-yellow pb-2 font-display text-lg font-bold text-brand-dark">
        {day}
        {dateText ? (
          <span className="text-sm font-normal text-brand-dark/60">
            {dateText}
          </span>
        ) : null}
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {villages.map((v) => (
          <li key={v.id} className="flex items-baseline justify-between gap-4">
            <span className="text-brand-dark">{v.name}</span>
            <span className="shrink-0 font-mono text-xs text-brand-dark/60">
              {v.pickup_time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
