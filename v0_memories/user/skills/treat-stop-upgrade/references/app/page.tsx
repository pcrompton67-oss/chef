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
import {
  DELIVERY_DAYS,
  deliveryDateFor,
  deliveryRangeFor,
  formatShortDate,
  isOrderingOpen,
  type Menu,
  type Village,
} from '@/lib/types'

// Always reflect the owner's current on/off switch.
export const dynamic = 'force-dynamic'

// Static class names so Tailwind keeps them. Four days go 2-up on tablets and
// 4-up on desktop; three days 3-up on desktop.
const ROUTE_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

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

function formatCutoff(cutoff: string | null): string {
  if (!cutoff) return ''
  return new Date(cutoff).toLocaleString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

export default async function HomePage() {
  const [active, villages, heroPhotos, upcoming, banner] = await Promise.all([
    getActiveMenu(),
    getVillages(),
    // A photo hiccup should never take the order page offline.
    listHeroPhotos().catch((): GalleryPhoto[] => []),
    listUpcomingDeliveries(HOME_UPCOMING_DELIVERIES).catch((): UpcomingDelivery[] => []),
    getVisibleBanner().catch(() => null),
  ])
  const open = isOrderingOpen(active)
  const range = deliveryRangeFor(
    active,
    villages.map((v) => v.delivery_day),
  )
  const cutoff = formatCutoff(active?.cutoff_at ?? null)
  const routeDays = DELIVERY_DAYS.map((day) => ({
    day,
    villages: villages.filter((v) => v.delivery_day === day),
  })).filter((d) => d.villages.length > 0)
  const routeGridCols =
    ROUTE_GRID_COLS[Math.min(routeDays.length, 4)] ?? ROUTE_GRID_COLS[2]

  return (
    <main className="flex min-h-dvh flex-col">
      {banner ? <AnnouncementBanner banner={banner} /> : null}
      {/* Hero — the logo's own green block, with the windmill mark as the signature element. */}
      <section className="bg-brand-green text-brand-yellow">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-5 py-14 text-center sm:py-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Magnificent Sausage Rolls & Sausages — windmill logo"
            className="h-52 w-52 rounded-full object-cover ring-4 ring-brand-yellow/60 sm:h-64 sm:w-64"
          />
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-yellow/80">
              Handcrafted in Valence-en-Poitou
            </p>
            <h1 className="max-w-3xl text-balance font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
              Magnificent Sausage Rolls &amp; Sausages
            </h1>
            <p className="font-display text-xl italic text-brand-cream/90 sm:text-2xl">
              We make, you discover
            </p>
          </div>

          {open ? (
            <div className="flex w-full max-w-md flex-col items-center gap-4">
              {range ? (
                <p className="text-pretty text-base text-brand-cream">
                  Now taking orders for delivery on{' '}
                  <span className="font-bold text-brand-yellow">{range}</span>
                </p>
              ) : null}
              <Link
                href="/order"
                className="flex w-full items-center justify-center gap-3 rounded-md bg-brand-yellow px-6 py-4 font-display text-xl font-bold text-brand-green-dark transition-colors hover:bg-brand-cream"
              >
                Order for this delivery
                <span aria-hidden className="text-2xl leading-none">
                  →
                </span>
              </Link>
              {cutoff ? (
                <p className="text-sm text-brand-cream/80">
                  Orders close {cutoff}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-md border border-brand-yellow/40 px-6 py-6">
              <p className="font-display text-2xl font-bold">
                {range
                  ? `Orders open soon for ${range}`
                  : 'Orders are opening soon'}
              </p>
              <p className="text-sm text-brand-cream/80">
                We deliver every two weeks. Check back shortly.
              </p>
            </div>
          )}

          {upcoming.length > 0 ? (
            <section
              aria-labelledby="next-deliveries"
              className="flex w-full max-w-md flex-col items-center gap-3 border-t border-brand-yellow/30 pt-6"
            >
              <h2
                id="next-deliveries"
                className="text-xs font-bold uppercase tracking-[0.3em] text-brand-yellow/80"
              >
                Next deliveries
              </h2>
              <ul className="flex flex-col items-center gap-1.5">
                {upcoming.map((d) => (
                  <li key={d.id} className="text-pretty text-base text-brand-cream">
                    {formatUpcoming(d.start_date, d.end_date)}
                    {d.note ? (
                      <span className="text-brand-cream/70">{` · ${d.note}`}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-14">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
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
          ].map((step) => (
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
          <section aria-label="Photos" className="flex flex-col gap-3">
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
              See all photos →
            </Link>
          </section>
        ) : null}

        {/* Delivery route */}
        {villages.length > 0 ? (
          <div className="flex flex-col gap-6 rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-bold text-brand-green">
                Drop-off towns
              </h2>
              <p className="text-sm text-brand-dark/65">
                Times are approximate — we visit around ten towns a day, so we
                may be a little early or late.
              </p>
            </div>
            <div className={`grid gap-8 ${routeGridCols}`}>
              {routeDays.map(({ day, villages: dayVillages }) => (
                <RouteColumn
                  key={day}
                  day={day}
                  villages={dayVillages}
                  dateLabel={deliveryDateFor(active, day)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-md bg-brand-green-dark p-6 text-brand-cream sm:p-8">
          <h2 className="font-display text-xl font-bold text-brand-yellow">
            Good to know
          </h2>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-brand-cream/90">
            <li>
              Sausage rolls are sold in packs of 4. Sausages are sold in packs
              of 6. Gluten-free options are the same price as regular.
            </li>
            <li>
              Everything is delivered individually frozen, ready to cook
              straight from the freezer.
            </li>
            <li>
              Products come with labels for ingredients, cooking and storage
              instructions.
            </li>
            <li>
              Payment is cash or cheque at your drop-off point.
            </li>
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
          Photo gallery
        </Link>
        <Link
          href="/data-policy"
          className="underline-offset-2 transition-colors hover:text-brand-green hover:underline"
        >
          Data-use policy
        </Link>
        <Link
          href="/manager"
          className="font-bold uppercase tracking-wide text-brand-dark/40 transition-colors hover:text-brand-green"
        >
          Owner login
        </Link>
      </footer>
    </main>
  )
}

function RouteColumn({
  day,
  villages,
  dateLabel,
}: {
  day: string
  villages: Village[]
  dateLabel: string | Date | null
}) {
  if (villages.length === 0) return null
  const dateText = formatShortDate(dateLabel)
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
