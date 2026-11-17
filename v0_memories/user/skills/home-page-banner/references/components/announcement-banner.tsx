import { formatBannerEnd, type SiteBanner } from '@/lib/banner-shared'

export function AnnouncementBanner({ banner }: { banner: SiteBanner }) {
  return (
    <section aria-label="Announcement" className="border-b-4 border-brand-green-dark bg-brand-yellow text-brand-green-dark">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 py-4 text-center">
        {banner.title ? (
          <p className="text-balance font-display text-xl font-bold leading-tight sm:text-2xl">
            {banner.title}
          </p>
        ) : null}
        {banner.message ? (
          <p className="max-w-2xl text-pretty text-sm leading-relaxed sm:text-base">{banner.message}</p>
        ) : null}
        {banner.ends_on ? (
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green-dark/70">
            Until {formatBannerEnd(banner.ends_on)}
          </p>
        ) : null}
      </div>
    </section>
  )
}
