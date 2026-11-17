import Link from 'next/link'
import { t } from '@/lib/content'
import { formatDate, formatMoney, localePath, type Locale } from '@/lib/i18n'
import { hasBankDetails, transferReference, type BankDetails } from '@/lib/email-templates'
import type { EventDetail } from '@/lib/events'
import { FadeIn } from '@/components/site/fade-in'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { buttonStyles } from '@/components/site/button-styles'

/** Shown after an order is placed: what happens next. */
export function ThankYouPage({
  event: e,
  locale,
  path,
  reference,
  card,
  transfer,
}: {
  event: EventDetail
  locale: Locale
  path: string
  reference: string | null
  /** A card order (issue #14): paid, still being confirmed, or not paid. Null otherwise. */
  card: 'paid' | 'pending' | 'unpaid' | null
  /** The deposit still to pay by bank transfer on this order, with where to pay it. */
  transfer: { depositCents: number; holdDays: number; bank: BankDetails } | null
}) {
  const c = t(locale).thanks
  const unpaid = card === 'unpaid'
  const text = card ? c.card[card] : c.text
  return (
    <div lang={locale} className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} path={path} />
      <main className="flex-1 px-4 py-24 text-center sm:px-8 sm:py-32">
        <FadeIn>
          <p className="caps text-gold-deep">{unpaid ? c.card.unpaidEyebrow : c.eyebrow}</p>
          <h1 className="mt-5 text-4xl uppercase tracking-[0.14em] text-charcoal sm:text-5xl">
            {unpaid ? c.card.unpaidTitle : c.title}
          </h1>
          <p className="mt-6 font-display text-xl italic text-stone">
            {e.theme} · {formatDate(e.date, locale)}
          </p>
          {reference && !unpaid ? (
            <p className="mt-3 text-sm tracking-[0.12em] text-stone">{c.reference(reference)}</p>
          ) : null}
        </FadeIn>
        <FadeIn delay={250}>
          <span className="rule my-10" aria-hidden />
          <div className="mx-auto max-w-md space-y-5 font-display text-xl leading-relaxed text-charcoal">
            {text.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {transfer && reference ? <TransferDetails locale={locale} reference={reference} {...transfer} /> : null}
          <Link
            href={localePath(`/dine-at-home/${e.slug}`, locale)}
            className={buttonStyles(unpaid ? 'solid' : 'outline', 'mt-12')}
          >
            {c.back}
          </Link>
        </FadeIn>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

/** Where and how to pay the deposit by bank transfer, with the exact amount and reference. */
function TransferDetails({
  locale,
  reference,
  depositCents,
  holdDays,
  bank,
}: {
  locale: Locale
  reference: string
  depositCents: number
  holdDays: number
  bank: BankDetails
}) {
  const c = t(locale)
  const r = c.email.received
  const amount = formatMoney(depositCents, locale)

  if (!hasBankDetails(bank)) {
    return <p className="mx-auto mt-10 max-w-md font-display text-xl leading-relaxed text-charcoal">{r.bankLater(amount)}</p>
  }

  const rows: [string, string][] = [
    [r.accountName, bank.accountName.trim()],
    [r.iban, bank.iban.trim()],
    ...(bank.bic.trim() ? [[r.bic, bank.bic.trim()] as [string, string]] : []),
    [r.amount, amount],
    [r.reference, transferReference(reference)],
  ]

  return (
    <section className="mx-auto mt-12 max-w-md border border-gold/60 px-5 py-7 text-left sm:px-8">
      <h2 className="caps text-center text-gold-deep">{r.payTitle}</h2>
      <p className="mt-4 text-center text-charcoal">
        {r.transferIntro(amount, holdDays)}
      </p>
      <dl className="mt-6 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border pb-2">
            <dt className="caps text-[0.65rem] text-stone">{label}</dt>
            <dd className="select-all break-all font-display text-lg tracking-wide text-charcoal">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-center text-sm text-stone">{r.transferNote}</p>
    </section>
  )
}
