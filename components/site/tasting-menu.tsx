import { Fragment } from 'react'
import { t, type TastingMenu as Menu } from '@/lib/content'
import type { Locale } from '@/lib/i18n'
import { FadeIn } from './fade-in'

/**
 * A menu laid out like Eleanor's printed ones: centred, spaced-capitals title
 * between long rules, small-caps course names, thin rules between courses
 * and middle dots between components.
 */
export function TastingMenu({ menu, locale }: { menu: Menu; locale: Locale }) {
  const words = t(locale).menuWords
  return (
    <div className="mx-auto max-w-2xl bg-ivory px-5 py-14 text-center shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-border/70 sm:px-12 sm:py-16">
      <FadeIn>
        <p className="caps text-stone">· {menu.eyebrow} ·</p>
        <h3 className="ruled-title mt-6 font-sans text-base font-normal uppercase tracking-[0.35em] text-charcoal sm:text-lg">
          <span className="px-1">{menu.title}</span>
        </h3>
      </FadeIn>

      <ol className="mt-10">
        {menu.courses.map((course, i) => (
          <FadeIn as="li" key={i} delay={i * 120} className="py-1">
            <span className="rule mb-8 w-24" aria-hidden />
            {course.dishes.map((dish, j) => (
              <Fragment key={j}>
                {j > 0 ? (
                  <p className="my-0.5 font-display text-base italic text-stone">
                    {words.or}
                  </p>
                ) : null}
                <p className="tasting-course">
                  <DishName name={dish} />
                </p>
              </Fragment>
            ))}
            <p className="tasting-components">{course.components.join(' · ')}</p>
            <div className="h-8" />
          </FadeIn>
        ))}
      </ol>

      <FadeIn>
        <span className="rule mb-10 w-40" aria-hidden />
        <p className="font-display text-2xl tracking-wider text-charcoal">{menu.price}</p>
        <p className="mt-3 text-sm tracking-wider text-stone">{menu.notes.join(' · ')}</p>
        {menu.footnote ? (
          <p className="mx-auto mt-4 max-w-sm font-display text-base italic leading-relaxed text-stone">
            {menu.footnote}
          </p>
        ) : null}
      </FadeIn>
    </div>
  )
}

/** Keeps a trailing "(v)" in lower case while the dish name is in small capitals. */
function DishName({ name }: { name: string }) {
  const m = name.match(/^(.*?)\s*(\([a-z]+\))$/i)
  if (!m) return <>{name}</>
  return (
    <>
      {m[1]}{'\u00a0'}
      <span className="font-sans text-sm text-stone" style={{ fontVariantCaps: 'normal' }}>
        {m[2].toLowerCase()}
      </span>
    </>
  )
}
