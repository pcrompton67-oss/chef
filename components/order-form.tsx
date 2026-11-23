'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { t } from '@/lib/content'
import { formatMoney, formatTime, localePath, type Locale } from '@/lib/i18n'
import type { EventDetail } from '@/lib/events'
import { buttonStyles } from '@/components/site/button-styles'
import { cn } from '@/lib/utils'
import { LEGAL_PATHS } from '@/lib/site'

type Props = {
  event: Pick<
    EventDetail,
    'slug' | 'priceCents' | 'depositCents' | 'courses' | 'collectionPoints'
  >
  locale: Locale
  /** Most diners this order can be for (places left, capped per order). */
  maxDiners: number
  /** Offer paying the deposit by card on Stripe (issue #14). Bank transfer only when false. */
  cardPayments: boolean
}

type Field =
  | 'collectionPoint'
  | 'choices'
  | 'name'
  | 'mobile'
  | 'email'
  | 'allergies'
  | 'agreed'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The Dine at Home order form, phone first: where to collect, how many diners,
 * a dish for each diner on the choice courses, then contact details.
 * The server checks everything again when the order is sent.
 */
export function OrderForm({ event, locale, maxDiners, cardPayments }: Props) {
  const c = t(locale).order
  const router = useRouter()
  const choiceCourses = event.courses.filter((course) => course.kind === 'choice')

  const [pointId, setPointId] = useState('')
  const [diners, setDiners] = useState(Math.min(2, maxDiners))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [allergies, setAllergies] = useState('')
  const [notes, setNotes] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [payment, setPayment] = useState<'card' | 'bank_transfer'>(cardPayments ? 'card' : 'bank_transfer')
  const byCard = cardPayments && payment === 'card'

  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)

  // Coming back from Stripe's page with the browser's Back button can show
  // this page as it was left ("Opening…"): make the button usable again.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setSending(false)
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  const chosen = (courseId: string) =>
    choiceCourses
      .find((course) => course.id === courseId)!
      .options.reduce((sum, o) => sum + (counts[o.id] ?? 0), 0)

  const allChosen = choiceCourses.every((course) => chosen(course.id) === diners)

  function setCount(optionId: string, n: number) {
    setCounts((prev) => ({ ...prev, [optionId]: Math.max(0, n) }))
    setErrors((prev) => ({ ...prev, choices: undefined }))
  }

  function check(): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {}
    if (!pointId) e.collectionPoint = c.errors.collectionPoint
    if (!allChosen) e.choices = c.errors.choices
    if (!name.trim()) e.name = c.errors.required
    if (!mobile.trim()) e.mobile = c.errors.required
    else if (mobile.replace(/\D/g, '').length < 6) e.mobile = c.errors.mobile
    if (!email.trim()) e.email = c.errors.required
    else if (!EMAIL.test(email.trim())) e.email = c.errors.email
    if (!allergies.trim()) e.allergies = c.errors.required
    if (!agreed) e.agreed = c.errors.agreed
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (sending) return
    setFormError('')
    const found = check()
    setErrors(found)
    if (Object.keys(found).length) {
      setFormError(c.errors.check)
      document.getElementById(`field-${Object.keys(found)[0]}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: event.slug,
          locale,
          collectionPointId: pointId,
          diners,
          choices: counts,
          name,
          mobile,
          email,
          allergies,
          notes,
          marketing,
          agreed,
          paymentMethod: byCard ? 'card' : 'bank_transfer',
        }),
      })
      const result = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        orderId?: string
        checkoutUrl?: string
        error?: string
        field?: Field | 'diners'
        placesLeft?: number
      }
      if (result.ok && result.checkoutUrl) {
        // Card: on to Stripe's payment page (the button stays "opening…" meanwhile).
        window.location.assign(result.checkoutUrl)
        return
      }
      if (result.ok && result.orderId) {
        router.push(
          `${localePath(`/dine-at-home/${event.slug}/thank-you`, locale)}?ref=${result.orderId}`,
        )
        return
      }
      if (result.error === 'closed') setFormError(c.errors.closed)
      else if (result.error === 'payment') setFormError(c.errors.payment)
      else if (result.error === 'not_enough') setFormError(c.errors.notEnough(result.placesLeft ?? 0))
      else if (result.error === 'choices') {
        setErrors({ choices: c.errors.choices })
        setFormError(c.errors.check)
      } else if (result.error === 'invalid' && result.field && result.field !== 'diners') {
        setErrors({ [result.field]: c.errors.required })
        setFormError(c.errors.check)
      } else setFormError(c.errors.generic)
    } catch {
      setFormError(c.errors.generic)
    }
    setSending(false)
  }

  const money = (cents: number) => formatMoney(cents, locale)

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-14">
      {/* Where to collect */}
      <Group id="field-collectionPoint" label={c.pointLabel} error={errors.collectionPoint}>
        <div className="space-y-2">
          {event.collectionPoints.map((p) => (
            <label
              key={p.id}
              className={cn(
                'flex cursor-pointer items-baseline gap-3 border px-4 py-3.5 font-display text-xl transition-colors duration-300',
                pointId === p.id
                  ? 'border-gold bg-cream text-charcoal'
                  : 'border-stone/30 text-charcoal hover:border-stone/60',
              )}
            >
              <input
                type="radio"
                name="collectionPoint"
                value={p.id}
                checked={pointId === p.id}
                onChange={() => {
                  setPointId(p.id)
                  setErrors((prev) => ({ ...prev, collectionPoint: undefined }))
                }}
                className="tick self-center"
              />
              <span>{p.place}</span>
              <span className="mb-1 flex-1 border-b border-dotted border-stone/40" aria-hidden />
              <span className="tabular-nums">{formatTime(p.time, locale)}</span>
            </label>
          ))}
        </div>
      </Group>

      {/* How many diners */}
      <Group label={c.dinersLabel}>
        <div className="flex justify-center">
          <Stepper
            value={diners}
            min={1}
            max={maxDiners}
            onChange={setDiners}
            display={c.diners(diners)}
            fewer={c.fewer}
            more={c.more}
            large
          />
        </div>
      </Group>

      {/* A dish for each diner on every choice course */}
      {choiceCourses.map((course) => {
        const n = chosen(course.id)
        const hint =
          n === diners ? c.choiceDone : n > diners ? c.choiceTooMany(n, diners) : c.choiceCount(n, diners)
        return (
          <Group
            key={course.id}
            id={course === choiceCourses[0] ? 'field-choices' : undefined}
            label={c.choiceLabel(course.name)}
            error={n !== diners ? errors.choices : undefined}
          >
            <ul className="divide-y divide-stone/20 border-y border-stone/20">
              {course.options.map((o) => (
                <li key={o.id} className="flex items-center gap-4 py-4">
                  <span className="tasting-course flex-1 text-left text-xl sm:text-xl">
                    {o.name}
                    {o.vegetarian ? (
                      <span className="ml-1 font-sans text-sm normal-case tracking-normal text-stone">
                        {t(locale).event.vegetarian}
                      </span>
                    ) : null}
                  </span>
                  <Stepper
                    value={counts[o.id] ?? 0}
                    min={0}
                    max={diners}
                    onChange={(v) => setCount(o.id, v)}
                    display={String(counts[o.id] ?? 0)}
                    fewer={`${c.fewer}: ${o.name}`}
                    more={`${c.more}: ${o.name}`}
                  />
                </li>
              ))}
            </ul>
            <p
              aria-live="polite"
              className={cn(
                'mt-3 text-center text-sm tracking-wider',
                n === diners ? 'text-gold-deep' : n > diners ? 'text-destructive' : 'text-stone',
              )}
            >
              {hint}
            </p>
          </Group>
        )
      })}

      {/* Contact details */}
      <Group label={c.detailsTitle}>
        <div className="space-y-7">
          <TextField
            id="field-name"
            label={c.name}
            value={name}
            onChange={(v) => {
              setName(v)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            error={errors.name}
            autoComplete="name"
          />
          <TextField
            id="field-mobile"
            label={c.mobile}
            value={mobile}
            onChange={(v) => {
              setMobile(v)
              setErrors((prev) => ({ ...prev, mobile: undefined }))
            }}
            error={errors.mobile}
            type="tel"
            autoComplete="tel"
          />
          <TextField
            id="field-email"
            label={c.email}
            value={email}
            onChange={(v) => {
              setEmail(v)
              setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            error={errors.email}
            type="email"
            autoComplete="email"
          />
          <TextField
            id="field-allergies"
            label={c.allergies}
            hint={c.allergiesHint}
            value={allergies}
            onChange={(v) => {
              setAllergies(v)
              setErrors((prev) => ({ ...prev, allergies: undefined }))
            }}
            error={errors.allergies}
            multiline
          />
          <TextField
            id="field-notes"
            label={c.notes}
            hint={c.notesHint}
            value={notes}
            onChange={setNotes}
            multiline
          />
        </div>
      </Group>

      {/* Summary, consent and agreement */}
      <div className="border border-stone/30 bg-cream px-5 py-8 sm:px-8">
        <p className="caps text-center text-gold-deep">{c.summaryTitle}</p>
        <span className="rule my-6 w-10" aria-hidden />
        <dl className="space-y-3 text-sm text-charcoal">
          <Row label={c.total} note={c.times(money(event.priceCents), diners)}>
            {money(event.priceCents * diners)}
          </Row>
          <Row
            label={c.deposit}
            note={c.times(money(event.depositCents), diners)}
            strong
          >
            {money(event.depositCents * diners)}
          </Row>
          <Row
            label={c.balance}
            note={c.times(money(event.priceCents - event.depositCents), diners)}
          >
            {money((event.priceCents - event.depositCents) * diners)}
          </Row>
        </dl>
        {cardPayments ? (
          <fieldset className="mt-8">
            <legend className="caps mb-4 w-full text-center text-[0.65rem] text-stone">{c.paymentLabel}</legend>
            <div className="space-y-2">
              {(
                [
                  ['card', c.payCard, c.payCardNote],
                  ['bank_transfer', c.payTransfer, c.payTransferNote],
                ] as const
              ).map(([value, label, note]) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer gap-3 border px-4 py-3 transition-colors duration-300',
                    payment === value ? 'border-gold bg-ivory' : 'border-stone/30 hover:border-stone/60',
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={value}
                    checked={payment === value}
                    onChange={() => setPayment(value)}
                    className="tick mt-1"
                  />
                  <span>
                    <span className="block font-display text-lg text-charcoal">{label}</span>
                    <span className="block text-sm leading-relaxed text-stone">{note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="mt-6 text-center font-display text-base italic leading-relaxed text-stone">
            {c.paymentNote}
          </p>
        )}
      </div>

      <div className="space-y-5">
        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-charcoal">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="tick mt-0.5"
          />
          <span>{c.marketing}</span>
        </label>
        <div id="field-agreed">
          <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-charcoal">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked)
                setErrors((prev) => ({ ...prev, agreed: undefined }))
              }}
              aria-invalid={!!errors.agreed}
              className="tick mt-0.5"
            />
            <span>
              {c.agreement} {c.agreementLinks.before}
              <AgreementLink href={localePath(LEGAL_PATHS.terms, locale)}>{c.agreementLinks.terms}</AgreementLink>
              {c.agreementLinks.middle}
              <AgreementLink href={localePath(LEGAL_PATHS.privacy, locale)}>{c.agreementLinks.privacy}</AgreementLink>
              {c.agreementLinks.after}
            </span>
          </label>
          <ErrorText>{errors.agreed}</ErrorText>
        </div>
      </div>

      <div className="text-center">
        <button
          type="submit"
          disabled={sending}
          className={buttonStyles('solid', 'w-full py-4 sm:w-auto sm:px-12')}
        >
          {byCard ? (sending ? c.submittingCard : c.submitCard) : sending ? c.submitting : c.submit}
        </button>
        {formError ? (
          <p role="alert" className="mt-5 text-sm leading-relaxed text-destructive">
            {formError}
          </p>
        ) : null}
      </div>
    </form>
  )
}

/** A titled part of the form, with its error underneath. */
function Group({
  id,
  label,
  error,
  children,
}: {
  id?: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <fieldset id={id} className="scroll-mt-24">
      <legend className="caps mb-6 w-full text-center text-gold-deep">{label}</legend>
      {children}
      <ErrorText center>{error}</ErrorText>
    </fieldset>
  )
}

function ErrorText({ children, center }: { children?: string; center?: boolean }) {
  if (!children) return null
  return (
    <p className={cn('mt-2 text-sm text-destructive', center && 'text-center')}>{children}</p>
  )
}

/** − value + with square, thin-bordered buttons. */
function Stepper({
  value,
  min,
  max,
  onChange,
  display,
  fewer,
  more,
  large,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  display: string
  fewer: string
  more: string
  large?: boolean
}) {
  const btn =
    'flex size-11 items-center justify-center border border-stone/40 text-lg text-charcoal transition-colors duration-300 hover:border-gold hover:text-gold-deep disabled:opacity-30 disabled:hover:border-stone/40 disabled:hover:text-charcoal'
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={fewer}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={cn(
          'text-center font-display tabular-nums text-charcoal',
          large ? 'min-w-32 text-2xl' : 'min-w-6 text-2xl',
        )}
      >
        {display}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={more}
      >
        +
      </button>
    </div>
  )
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  multiline,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
  autoComplete?: string
  multiline?: boolean
}) {
  const input = cn(
    'mt-2 block w-full rounded-none border-0 border-b bg-transparent px-0 py-2 text-base text-charcoal outline-none transition-colors duration-300 focus:border-gold',
    error ? 'border-destructive' : 'border-stone/50',
  )
  return (
    <div className="scroll-mt-24" id={id}>
      <label htmlFor={`${id}-input`} className="text-xs uppercase tracking-[0.22em] text-stone">
        {label}
      </label>
      {hint ? <p className="mt-1 text-sm leading-relaxed text-stone">{hint}</p> : null}
      {multiline ? (
        <textarea
          id={`${id}-input`}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={cn(input, 'resize-y')}
        />
      ) : (
        <input
          id={`${id}-input`}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={input}
        />
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

function Row({
  label,
  note,
  strong,
  children,
}: {
  label: string
  note: string
  strong?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className={cn(strong ? 'text-charcoal' : 'text-stone')}>
        {label}
        <span className="ml-2 text-xs text-stone/80">{note}</span>
      </dt>
      <span className="mb-1 flex-1 border-b border-dotted border-stone/30" aria-hidden />
      <dd className={cn('font-display tabular-nums', strong ? 'text-2xl' : 'text-xl')}>
        {children}
      </dd>
    </div>
  )
}

/** Opens a legal page in a new tab, so the order being filled in isn't lost. */
function AgreementLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="border-b border-gold hover:text-gold-deep">
      {children}
    </a>
  )
}
