import { cn } from '@/lib/utils'

/**
 * Button look for links and buttons on the public site: square corners,
 * thin border, spaced capitals. No bright fills.
 */
export function buttonStyles(
  variant: 'solid' | 'outline' | 'text' = 'outline',
  className?: string,
) {
  return cn(
    'inline-flex items-center justify-center gap-2 px-7 py-3 font-sans text-xs font-normal uppercase tracking-[0.28em] transition-colors duration-500 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-50',
    variant === 'solid' && 'bg-charcoal text-ivory hover:bg-stone',
    variant === 'outline' &&
      'border border-charcoal/70 text-charcoal hover:border-gold hover:text-gold-deep',
    variant === 'text' &&
      'px-0 py-1 text-charcoal underline-offset-8 hover:text-gold-deep hover:underline',
    className,
  )
}
