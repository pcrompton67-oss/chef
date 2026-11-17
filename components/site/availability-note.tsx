import { t } from '@/lib/content'
import type { Locale } from '@/lib/i18n'
import type { EventSummary } from '@/lib/events'
import { cn } from '@/lib/utils'

/** "12 places left", "Sold out", "Orders closed" or "This evening has passed". */
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
  const text =
    event.availability === 'open'
      ? c.placesLeft(event.placesLeft)
      : event.availability === 'sold_out'
        ? c.soldOut
        : event.availability === 'closed'
          ? c.closed
          : c.past
  return (
    <p
      className={cn(
        'text-xs uppercase tracking-[0.25em]',
        event.availability === 'open' ? 'text-stone' : 'text-gold-deep',
        className,
      )}
    >
      {text}
    </p>
  )
}
