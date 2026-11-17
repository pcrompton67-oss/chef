import { Fragment } from "react";
import Image from "next/image";
import { t, type TastingMenu as Menu } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { FadeIn } from "./fade-in";

/**
 * A menu laid out like Eleanor's printed ones: a white card with softly rounded
 * corners (the one exception to the site's square corners) on a band of her
 * gold, her round logo over the top edge, the date, a spaced-capitals title
 * between long rules, small-caps course names, thin rules between courses and
 * middle dots between components.
 */
export function TastingMenu({ menu, locale }: { menu: Menu; locale: Locale }) {
  const words = t(locale).menuWords;
  return (
    <div className="mx-auto max-w-2xl bg-gold px-3 pb-3 pt-16 sm:px-8 sm:pb-8 sm:pt-20 print:break-inside-avoid print:bg-transparent print:p-0">
      <div className="relative rounded-[1.25rem] bg-ivory px-5 pb-14 pt-20 text-center sm:rounded-[1.75rem] sm:px-12 sm:pb-16 sm:pt-24 print:ring-1 print:ring-stone/30">
        {/* Her round logo, overlapping the top edge of the card */}
        <div className="absolute left-1/2 top-0 size-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.12)] ring-1 ring-stone/15 sm:size-32">
          <Image
            src="/CEJ_Logo.jpg"
            alt=""
            width={256}
            height={256}
            className="size-full scale-[1.04] object-cover"
          />
        </div>

        <FadeIn>
          <p className="font-sans text-lg font-normal uppercase tracking-[0.18em] text-charcoal sm:text-xl">
            · {menu.eyebrow} ·
          </p>
          {menu.date ? (
            <p className="mt-1.5 text-sm tracking-[0.12em] text-charcoal">
              {menu.date}
            </p>
          ) : null}
          <span className="rule mt-3 w-20" aria-hidden />
          <h3 className="ruled-title mt-6 font-sans text-base font-normal uppercase tracking-[0.35em] text-charcoal sm:text-xl">
            <span className="px-1">{menu.title}</span>
          </h3>
        </FadeIn>

        <ol className="mt-10">
          {menu.courses.map((course, i) => (
            <FadeIn as="li" key={i} delay={i * 120} className="py-1">
              <span
                className={
                  i === 0 ? "rule mb-8 w-48 sm:w-72" : "rule mb-8 w-32 sm:w-48"
                }
                aria-hidden
              />
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
              <p className="tasting-components">
                {course.components.join(" · ")}
              </p>
              <div className="h-8" />
            </FadeIn>
          ))}
        </ol>

        <FadeIn>
          <span className="rule mb-10 w-40" aria-hidden />
          <p className="font-display text-2xl tracking-wider text-charcoal">
            {menu.price}
          </p>
          <p className="mt-3 text-sm tracking-wider text-stone">
            {menu.notes.join(" · ")}
          </p>
          {menu.footnote ? (
            <p className="mx-auto mt-4 max-w-sm font-display text-base italic leading-relaxed text-stone">
              {menu.footnote}
            </p>
          ) : null}
        </FadeIn>
      </div>
    </div>
  );
}

/** Keeps a trailing "(v)" in lower case while the dish name is in small capitals. */
function DishName({ name }: { name: string }) {
  const m = name.match(/^(.*?)\s*(\([a-z]+\))$/i);
  if (!m) return <>{name}</>;
  return (
    <>
      {m[1]}
      {"\u00a0"}
      <span
        className="font-sans text-sm text-stone"
        style={{ fontVariantCaps: "normal" }}
      >
        {m[2].toLowerCase()}
      </span>
    </>
  );
}
