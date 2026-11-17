'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Check } from 'lucide-react'
import {
  deliveryDateFor,
  formatDeliveryRange,
  formatPrice,
  formatSaleDate,
  isMeatFlavour,
  isOrderingOpen,
  isSausageMeat,
  type Menu,
  type MenuItem,
  type Village,
} from '@/lib/types'
import { ConsentCheckbox } from '@/features/customers/consent-checkbox'
import { SausageMeatPicker } from './sausage-meat-picker'
import { LanguageSwitch } from '@/components/language-switch'
import {
  categoryName,
  dateLocale,
  dayName,
  localePath,
  type Locale,
} from '@/lib/i18n'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type MenuItemsResponse = { menuId: number | null; items: MenuItem[] }

// Display order for categories on the customer menu.
const CATEGORY_ORDER = [
  'Sausage Rolls',
  'Sausages',
  'Gluten Free Sausages',
  'Breakfast Patties',
  'Christmas',
]

const CATEGORY_NOTES: Record<Locale, Record<string, string>> = {
  en: {
    'Sausage Rolls':
      'Packs of 4 — delivered individually frozen, ready to cook straight from the freezer.',
    Sausages: 'Packs of 6 — delivered individually frozen.',
    'Gluten Free Sausages': 'Packs of 6, same price as regular.',
    'Breakfast Patties':
      'Approx. 100g each with no natural skin — make your own sausage and egg muffin. Priced per patty.',
    Christmas: 'Our special Christmas treats with limited availability',
  },
  fr: {
    'Sausage Rolls':
      'Par 4 — livrés surgelés individuellement, prêts à cuire directement depuis le congélateur.',
    Sausages: 'Par 6 — livrées surgelées individuellement.',
    'Gluten Free Sausages': 'Par 6, au même prix que les saucisses classiques.',
    'Breakfast Patties':
      'Environ 100 g chacune, sans boyau — idéales pour un muffin saucisse-œuf maison. Prix à l’unité.',
    Christmas: 'Nos spécialités de Noël, en quantité limitée',
  },
}

const TEXT = {
  en: {
    orderReceived: 'Order received',
    thanks: (n: string) => `Thanks, ${n}!`,
    orderIn: 'Your order is in. We’ll see you in',
    yourTown: 'your town',
    on: (w: string) => ` on ${w}`,
    at: (t: string) => ` at approx. ${t}`,
    payOnDay: '. Payment is cash or cheque on the day.',
    another: 'Place another order',
    delivery: (r: string) => `Delivery ${r}`,
    fortnightly: 'Fortnightly delivery',
    ordersClose: 'Orders close',
    openingSoon: (r: string) =>
      `Orders will be opening soon${r ? ` for ${r}` : ''}. Check back shortly!`,
    closed: 'Ordering has closed for this delivery. Check back soon!',
    loading: 'Loading menu…',
    noMenu: 'No menu is open right now. Please check back soon.',
    yourDetails: 'Your details',
    name: 'Name',
    email: 'Email',
    town: 'Drop-off town',
    chooseTown: 'Choose your town…',
    approx: (t: string) => ` — approx. ${t}`,
    townsNote: 'Times are approximate — we visit around ten towns a day.',
    seasonal: 'Seasonal',
    soldOut: 'Sold out',
    removeOne: (n: string) => `Remove one ${n}`,
    addOne: (n: string) => `Add one ${n}`,
    notes: 'Notes (optional)',
    notesPlaceholder: 'Allergies, how you’d like your patties packed, special requests…',
    items: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
    placing: 'Placing…',
    place: 'Place order',
    orderingClosed: 'Ordering closed',
    errName: 'Please enter your name.',
    errEmail: 'Please enter a valid email.',
    errTown: 'Please choose a drop-off town.',
    errItems: 'Please add at least one item.',
    errGeneric: 'Could not place your order.',
    errNetwork: 'Network error — please try again.',
    dupWarn:
      'It looks like you’ve already ordered for this delivery. Place another order anyway?',
    dupConfirm: 'Yes, place it',
    dupCancel: 'Go back',
    back: 'Back to home',
    logoAlt: 'Magnificent Sausage Rolls & Sausages logo',
  },
  fr: {
    orderReceived: 'Commande reçue',
    thanks: (n: string) => `Merci, ${n} !`,
    orderIn: 'Votre commande est enregistrée. Rendez-vous à',
    yourTown: 'votre point de retrait',
    on: (w: string) => ` le ${w}`,
    at: (t: string) => ` vers ${t}`,
    payOnDay: '. Paiement en espèces ou par chèque le jour même.',
    another: 'Passer une autre commande',
    delivery: (r: string) => `Livraison ${r}`,
    fortnightly: 'Livraison tous les quinze jours',
    ordersClose: 'Fin des commandes',
    openingSoon: (r: string) =>
      `Les commandes ouvriront bientôt${r ? ` pour le ${r}` : ''}. Revenez un peu plus tard !`,
    closed: 'Les commandes sont closes pour cette livraison. Revenez bientôt !',
    loading: 'Chargement du menu…',
    noMenu: 'Aucun menu n’est ouvert pour le moment. Revenez bientôt.',
    yourDetails: 'Vos coordonnées',
    name: 'Nom',
    email: 'E-mail',
    town: 'Point de retrait',
    chooseTown: 'Choisissez votre ville…',
    approx: (t: string) => ` — vers ${t}`,
    townsNote: 'Horaires approximatifs — nous passons dans une dizaine de villes par jour.',
    seasonal: 'De saison',
    soldOut: 'Épuisé',
    removeOne: (n: string) => `Retirer un ${n}`,
    addOne: (n: string) => `Ajouter un ${n}`,
    notes: 'Remarques (facultatif)',
    notesPlaceholder: 'Allergies, emballage des galettes, demandes particulières…',
    items: (n: number) => `${n} article${n > 1 ? 's' : ''}`,
    placing: 'Envoi…',
    place: 'Commander',
    orderingClosed: 'Commandes closes',
    errName: 'Merci d’indiquer votre nom.',
    errEmail: 'Merci d’indiquer une adresse e-mail valide.',
    errTown: 'Merci de choisir un point de retrait.',
    errItems: 'Merci d’ajouter au moins un article.',
    errGeneric: 'Impossible d’enregistrer votre commande.',
    errNetwork: 'Erreur réseau — merci de réessayer.',
    dupWarn:
      'Il semble que vous ayez déjà commandé pour cette livraison. Passer quand même une autre commande ?',
    dupConfirm: 'Oui, commander',
    dupCancel: 'Retour',
    back: 'Retour à l’accueil',
    logoAlt: 'Logo Magnificent Sausage Rolls & Sausages',
  },
} as const

function formatCutoff(cutoff: string | null, locale: Locale): string {
  if (!cutoff) return ''
  return new Date(cutoff).toLocaleString(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

export function OrderClient({ locale = 'en' }: { locale?: Locale }) {
  const t = TEXT[locale]
  const { data: menuData, isLoading: menuLoading } =
    useSWR<MenuItemsResponse>('/api/menu-items', fetcher)
  const { data: menus } = useSWR<Menu[]>('/api/menus', fetcher)
  const { data: villages } = useSWR<Village[]>('/api/villages', fetcher)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [villageId, setVillageId] = useState('')
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(true)
  const [qty, setQty] = useState<Record<number, number>>({})
  // Sausage meat packs per flavour (keyed by the sausage's menu item id).
  const [meatQty, setMeatQty] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Shown when the server says this email already has an order for this delivery.
  const [dupWarning, setDupWarning] = useState(false)
  const [done, setDone] = useState<null | {
    name: string
    village: Village | null
  }>(null)

  const items = menuData?.items ?? []
  const activeMenu = menus?.find((m) => m.is_active) ?? null
  const open = isOrderingOpen(activeMenu)
  const range = formatDeliveryRange(
    activeMenu?.sale_date ?? null,
    activeMenu?.sale_date_end ?? null,
    locale,
  )

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const item of items) {
      const arr = map.get(item.category) ?? []
      arr.push(item)
      map.set(item.category, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [items])

  const itemsById = useMemo(() => {
    const m = new Map<number, MenuItem>()
    for (const i of items) m.set(i.id, i)
    return m
  }, [items])

  const villagesByDay = useMemo(() => {
    const map = new Map<string, Village[]>()
    for (const v of villages ?? []) {
      const key = v.delivery_day || 'Other'
      const arr = map.get(key) ?? []
      arr.push(v)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [villages])

  const meatItem = items.find(isSausageMeat) ?? null
  const meatFlavours = useMemo(() => items.filter(isMeatFlavour), [items])
  const meatCount = Object.values(meatQty).reduce((a, b) => a + b, 0)

  const totalItems = Object.values(qty).reduce((a, b) => a + b, 0) + meatCount
  const totalCents =
    Object.entries(qty).reduce((sum, [id, q]) => {
      const item = itemsById.get(Number(id))
      return item ? sum + item.price_cents * q : sum
    }, 0) + (meatItem ? meatItem.price_cents * meatCount : 0)

  function setItemQty(id: number, next: number) {
    setQty((c) => {
      const copy = { ...c }
      const clamped = Math.max(0, Math.min(99, next))
      if (clamped === 0) delete copy[id]
      else copy[id] = clamped
      return copy
    })
  }

  function setMeatFlavourQty(flavourId: number, next: number) {
    setMeatQty((c) => {
      const copy = { ...c }
      const clamped = Math.max(0, Math.min(99, next))
      if (clamped === 0) delete copy[flavourId]
      else copy[flavourId] = clamped
      return copy
    })
  }

  function dayDateFor(v: Village | null): string {
    if (!v || !activeMenu) return ''
    const date = deliveryDateFor(activeMenu, v.delivery_day)
    return date ? formatSaleDate(date, locale) : range
  }

  async function submit(confirmDuplicate = false) {
    setError(null)
    setDupWarning(false)
    if (!name.trim()) return setError(t.errName)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError(t.errEmail)
    if (!villageId) return setError(t.errTown)
    if (totalItems === 0) return setError(t.errItems)

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          email: email.trim(),
          village_id: Number(villageId),
          notes: notes.trim(),
          marketing_consent: consent,
          confirm_duplicate: confirmDuplicate,
          items: [
            ...Object.entries(qty).map(([id, q]) => ({
              menu_item_id: Number(id),
              quantity: q,
            })),
            ...(meatItem
              ? Object.entries(meatQty).map(([flavourId, q]) => ({
                  menu_item_id: meatItem.id,
                  flavour_item_id: Number(flavourId),
                  quantity: q,
                }))
              : []),
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 409 && err.duplicate) {
          setDupWarning(true)
          return
        }
        setError(err.error || t.errGeneric)
        return
      }
      const village =
        villages?.find((v) => v.id === Number(villageId)) ?? null
      setDone({ name: name.trim(), village })
    } catch {
      setError(t.errNetwork)
    } finally {
      setSubmitting(false)
    }
  }

  // Success screen.
  if (done) {
    const when = dayDateFor(done.village)
    return (
      <div lang={locale} className="min-h-dvh bg-background">
        <BrandHeader subtitle={t.orderReceived} locale={locale} />
        <main className="mx-auto max-w-xl px-5 py-10">
          <div className="rounded-md border border-brand-green/40 bg-card p-8 text-center">
            <div
              aria-hidden
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-green text-brand-yellow"
            >
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-dark">
              {t.thanks(done.name)}
            </h2>
            <p className="mt-2 text-pretty leading-relaxed text-brand-dark/70">
              {t.orderIn}{' '}
              <span className="font-semibold text-brand-dark">
                {done.village?.name ?? t.yourTown}
              </span>
              {when ? t.on(when) : ''}
              {done.village?.pickup_time ? t.at(done.village.pickup_time) : ''}
              {t.payOnDay}
            </p>
            <button
              type="button"
              onClick={() => {
                setDone(null)
                setName('')
                setEmail('')
                setVillageId('')
                setNotes('')
                setConsent(true)
                setQty({})
                setMeatQty({})
              }}
              className="mt-6 rounded-md bg-brand-green px-6 py-3 font-display text-lg font-bold text-brand-cream transition-colors hover:bg-brand-green-dark"
            >
              {t.another}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div lang={locale} className="min-h-dvh bg-background pb-40">
      <BrandHeader subtitle={range ? t.delivery(range) : t.fortnightly} locale={locale} />

      <main className="mx-auto max-w-xl px-4">
        {/* Cutoff / availability banner */}
        {activeMenu && (activeMenu.cutoff_at || !open) ? (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              open
                ? 'border-brand-yellow bg-brand-yellow/15 text-brand-dark'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {open ? (
              <>
                <span className="font-bold uppercase tracking-wide">
                  {t.ordersClose}
                </span>{' '}
                {formatCutoff(activeMenu.cutoff_at, locale)}
              </>
            ) : activeMenu.orders_open === false ? (
              <span className="font-bold">{t.openingSoon(range)}</span>
            ) : (
              <span className="font-bold">{t.closed}</span>
            )}
          </div>
        ) : null}

        {menuLoading ? (
          <p className="py-10 text-center text-brand-dark/60">{t.loading}</p>
        ) : !activeMenu || items.length === 0 ? (
          <p className="py-10 text-center text-brand-dark/60">{t.noMenu}</p>
        ) : (
          <>
            {/* Your details */}
            <section className="mt-4 rounded-md border border-border bg-card p-4">
              <h2 className="mb-3 font-display text-lg font-bold text-brand-green">
                {t.yourDetails}
              </h2>
              <div className="flex flex-col gap-3">
                <Field label={t.name}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Claire Martin"
                    disabled={!open}
                    className="w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
                  />
                </Field>
                <Field label={t.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={!open}
                    className="w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
                  />
                </Field>
                <Field label={t.town}>
                  <select
                    value={villageId}
                    onChange={(e) => setVillageId(e.target.value)}
                    disabled={!open}
                    className="w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
                  >
                    <option value="">{t.chooseTown}</option>
                    {villagesByDay.map(([day, list]) => (
                      <optgroup key={day} label={dayName(day, locale)}>
                        {list.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                            {v.pickup_time ? t.approx(v.pickup_time) : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-brand-dark/55">
                    {t.townsNote}
                  </span>
                </Field>
              </div>
            </section>

            {/* Reminder opt-in */}
            <section className="mt-4 rounded-md border border-border bg-card p-4">
              <ConsentCheckbox
                checked={consent}
                onChange={setConsent}
                disabled={!open}
                locale={locale}
              />
            </section>

            {/* Menu */}
            <div className="flex flex-col gap-8 py-6">
              {grouped.map(([category, catItems]) => (
                <section key={category}>
                  {category ? (
                    <div className="mb-3 flex flex-col gap-1 border-b-2 border-brand-yellow pb-2">
                      <h2 className="font-display text-xl font-bold text-brand-green">
                        {categoryName(category, locale)}
                      </h2>
                      {CATEGORY_NOTES[locale][category] ? (
                        <p className="text-xs leading-relaxed text-brand-dark/60">
                          {CATEGORY_NOTES[locale][category]}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {catItems.map((item) => {
                      if (isSausageMeat(item)) {
                        return (
                          <SausageMeatPicker
                            key={item.id}
                            item={item}
                            flavours={meatFlavours}
                            qty={meatQty}
                            onChange={setMeatFlavourQty}
                            disabled={!open}
                            locale={locale}
                          />
                        )
                      }
                      const q = qty[item.id] ?? 0
                      const soldOut = item.is_sold_out
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 rounded-md border bg-card p-2 pl-4 transition-colors ${
                            q > 0 ? 'border-brand-green' : 'border-border'
                          } ${soldOut ? 'opacity-60' : ''}`}
                        >
                          <div className="flex flex-1 flex-col gap-0.5 py-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-brand-dark">
                                {item.name}
                              </span>
                              <span className="text-sm tabular-nums text-brand-dark/60">
                                {formatPrice(item.price_cents)}
                              </span>
                            </div>
                            {item.description ? (
                              <p className="text-xs leading-relaxed text-brand-dark/60">
                                {item.description}
                              </p>
                            ) : null}
                            {item.is_seasonal ? (
                              <span className="mt-1 inline-flex w-fit items-center rounded-sm bg-brand-yellow px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                                {t.seasonal}
                              </span>
                            ) : null}
                          </div>
                          {soldOut && q === 0 ? (
                            <span className="rounded-md bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-dark/70">
                              {t.soldOut}
                            </span>
                          ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={t.removeOne(item.name)}
                              onClick={() => setItemQty(item.id, q - 1)}
                              disabled={!open || q === 0}
                              className="h-10 w-10 rounded-md bg-muted text-xl font-bold text-brand-dark disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-lg font-bold tabular-nums text-brand-green">
                              {q}
                            </span>
                            <button
                              type="button"
                              aria-label={t.addOne(item.name)}
                              onClick={() => setItemQty(item.id, q + 1)}
                              disabled={!open || soldOut}
                              className="h-10 w-10 rounded-md bg-brand-green text-xl font-bold text-brand-cream disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            {/* Notes */}
            <section className="rounded-md border border-border bg-card p-4">
              <Field label={t.notes}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  disabled={!open}
                  placeholder={t.notesPlaceholder}
                  className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
                />
              </Field>
            </section>
          </>
        )}
      </main>

      {/* Sticky submit bar */}
      {activeMenu && items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-xl">
            {error ? (
              <p className="mb-2 text-center text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            {dupWarning ? (
              <div
                role="alert"
                className="mb-3 rounded-md border border-brand-yellow bg-brand-yellow/20 p-3 text-center"
              >
                <p className="text-sm font-semibold text-brand-dark">{t.dupWarn}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDupWarning(false)}
                    disabled={submitting}
                    className="flex-1 rounded-md border border-brand-dark/30 bg-card py-2 text-sm font-bold text-brand-dark"
                  >
                    {t.dupCancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => submit(true)}
                    disabled={submitting}
                    className="flex-1 rounded-md bg-brand-green py-2 text-sm font-bold text-brand-cream hover:bg-brand-green-dark disabled:opacity-40"
                  >
                    {t.dupConfirm}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <div className="min-w-24">
                <div className="text-xs uppercase tracking-wide text-brand-dark/60">
                  {t.items(totalItems)}
                </div>
                <div className="font-display text-2xl font-bold tabular-nums text-brand-dark">
                  {formatPrice(totalCents)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => submit()}
                disabled={!open || submitting || dupWarning}
                className="flex-1 rounded-md bg-brand-green py-4 font-display text-xl font-bold text-brand-cream transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? t.placing : open ? t.place : t.orderingClosed}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/60">
        {label}
      </span>
      {children}
    </label>
  )
}

function BrandHeader({ subtitle, locale }: { subtitle: string; locale: Locale }) {
  const t = TEXT[locale]
  return (
    <header className="flex items-center gap-4 bg-brand-green px-5 py-4 text-brand-cream">
      <Link
        href={localePath('/', locale)}
        aria-label={t.back}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-cream/15 text-2xl leading-none transition-colors hover:bg-brand-cream/25"
      >
        ‹
      </Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt={t.logoAlt}
        className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-brand-yellow/60"
      />
      <div className="flex-1">
        <h1 className="font-display text-xl font-bold leading-tight text-brand-yellow">
          Magnificent Sausage Rolls
        </h1>
        <p className="text-sm text-brand-cream/80">{subtitle}</p>
      </div>
      <LanguageSwitch locale={locale} path="/order" />
    </header>
  )
}
