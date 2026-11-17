import { t } from '@/lib/content'
import type { Locale } from '@/lib/i18n'
import { LOW_PLACES, type EventSummary } from '@/lib/events'
import { cn } from '@/lib/utils'

/** "Places available", "Only 3 places left" (8 or fewer), "Sold out", "Orders closed" or "This evening has passed". */
export function AvailabilityNote({
  event,
  locale,
  className,
}: {
  event: Pick<EventSummary, 'availability' | 'placesLeft'>
  locale: Locale
  className?: string
}) {
  const c = t(locale).event
  const low = event.availability === 'open' && event.placesLeft <= LOW_PLACES
  const text =
    event.availability === 'open'
      ? low
        ? c.placesLeftLow(event.placesLeft)
        : c.placesAvailable
      : event.availability === 'sold_out'
        ? c.soldOut
        : event.availability === 'closed'
          ? c.closed
          : c.past
  return (
    <p
      className={cn(
        'text-xs uppercase tracking-[0.25em]',
        event.availability === 'open' && !low ? 'text-stone' : 'text-gold-deep',
        className,
      )}
    >
      {text}
    </p>
  )
}
