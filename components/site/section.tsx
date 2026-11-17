import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FadeIn } from './fade-in'

/** A page section with generous spacing and an optional spaced-capitals title. */
export function Section({
  id,
  eyebrow,
  title,
  children,
  className,
  tone = 'cream',
}: {
  id?: string
  eyebrow?: string
  title?: string
  children: ReactNode
  className?: string
  tone?: 'cream' | 'ivory'
}) {
  return (
    <section
      id={id}
      className={cn(
        'px-4 py-20 sm:px-8 sm:py-28',
        tone === 'ivory' ? 'bg-ivory' : 'bg-cream',
        className,
      )}
    >
      <div className="mx-auto max-w-5xl">
        {eyebrow || title ? (
          <FadeIn className="mb-12 text-center sm:mb-16">
            {eyebrow ? <p className="caps text-gold-deep">{eyebrow}</p> : null}
            {title ? (
              <h2 className="mt-4 text-4xl text-charcoal sm:text-5xl">{title}</h2>
            ) : null}
            <span className="rule mt-6" aria-hidden />
          </FadeIn>
        ) : null}
        {children}
      </div>
    </section>
  )
}
