'use client'

import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import useSWR, { mutate } from 'swr'
import { getStoredPin } from '@/components/pin-gate'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import {
  DELIVERY_DAYS,
  deliveryDateFor,
  formatDeliveryRange,
  formatPrice,
  flavourLabel,
  formatSaleDate,
  isMeatFlavour,
  isOrderingOpen,
  isSausageMeat,
  lineKey,
  orderItemLabel,
  groupByMeat,
  orderTotal,
  type Menu,
  type MenuItem,
  type Order,
  type OrderItem,
  type Village,
} from '@/lib/types'
import {
  CustomersTab,
  SendReminderPanel,
} from '@/features/customers/manager-ui'
import { findDuplicates, type DuplicateKind } from '@/lib/duplicates'
import { PickupReminderPanel } from '@/features/pickup-reminders/manager-ui'
import { LastCallPanel } from '@/features/last-call/manager-ui'
import { GalleryTab } from '@/features/gallery/manager-ui'
import { UpcomingDeliveriesPanel } from '@/features/upcoming-deliveries/manager-ui'
import { BannerPanel } from '@/features/banner/manager-ui'

const fetcher = (url: string) =>
  fetch(url, { headers: pinHeaders() }).then((r) => r.json())

function pinHeaders(): Record<string, string> {
  return { 'x-pin': getStoredPin('manager') }
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...pinHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Request failed')
  }
  return res.json().catch(() => ({}))
}

type Tab =
  | 'delivery'
  | 'menu'
  | 'villages'
  | 'orders'
  | 'catalog'
  | 'master-villages'
  | 'customers'
  | 'gallery'
  | 'upcoming'
  | 'banner'

type DeliveryTabId = 'delivery' | 'menu' | 'villages' | 'orders'

const DELIVERY_SUBTABS: { id: DeliveryTabId; label: string }[] = [
  { id: 'delivery', label: 'Overview' },
  { id: 'menu', label: 'Menu' },
  { id: 'villages', label: 'Drop-offs' },
  { id: 'orders', label: 'Orders' },
]

const TOP_TABS = [
  { id: 'delivery-group', label: 'Delivery' },
  { id: 'upcoming', label: 'Next deliveries' },
  { id: 'banner', label: 'Banner' },
  { id: 'catalog', label: 'Products' },
  { id: 'master-villages', label: 'Drop-offs' },
  { id: 'customers', label: 'Customers' },
  { id: 'gallery', label: 'Gallery' },
] as const

function isDeliveryTab(tab: Tab): tab is DeliveryTabId {
  return DELIVERY_SUBTABS.some((t) => t.id === tab)
}

const customerApi = { fetcher, send }

// A sensible menu order for grouping products by category throughout the console.
const CATEGORY_ORDER = [
  'Sausage Rolls',
  'Sausages',
  'Gluten Free Sausages',
  'Breakfast Patties',
  'Christmas',
]

// Sort comparator: known categories in CATEGORY_ORDER first, then extras A–Z.
function byCategoryOrder(a: string, b: string) {
  const ai = CATEGORY_ORDER.indexOf(a)
  const bi = CATEGORY_ORDER.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

function byDayOrder(a: string, b: string) {
  const days: readonly string[] = DELIVERY_DAYS
  const ai = days.indexOf(a)
  const bi = days.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

export function ManagerConsole() {
  const [tab, setTab] = useState<Tab>('delivery')
  const [lastDeliveryTab, setLastDeliveryTab] =
    useState<DeliveryTabId>('delivery')
  const inDelivery = isDeliveryTab(tab)

  function openDeliveryTab(id: DeliveryTabId) {
    setTab(id)
    setLastDeliveryTab(id)
  }

  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="flex items-center gap-4 bg-brand-green px-5 py-4 text-brand-cream print:hidden">
        <Link
          href="/"
          aria-label="Back to home"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-cream/15 text-2xl leading-none transition-colors hover:bg-brand-cream/25"
        >
          ‹
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-brand-yellow/60"
        />
        <div>
          <h1 className="font-display text-xl font-bold leading-tight text-brand-yellow">
            Management Console
          </h1>
          <p className="text-sm text-brand-cream/80">
            Magnificent Sausage Rolls &amp; Sausages
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <nav
          aria-label="Sections"
          className="flex gap-1 overflow-x-auto px-4 py-2"
        >
          {TOP_TABS.map((t) => {
            const active =
              t.id === 'delivery-group' ? inDelivery : tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() =>
                  t.id === 'delivery-group'
                    ? setTab(lastDeliveryTab)
                    : setTab(t.id)
                }
                className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? 'bg-brand-green text-brand-cream'
                    : 'text-brand-dark hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>

        {inDelivery ? (
          <nav
            aria-label="Delivery"
            className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5"
          >
            {DELIVERY_SUBTABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => openDeliveryTab(t.id)}
                  className={`shrink-0 border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-brand-green text-brand-green'
                      : 'border-transparent text-brand-dark/70 hover:text-brand-dark'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>
        ) : null}
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5">
  {tab === 'delivery' ? <DeliveryTab /> : null}
  {tab === 'upcoming' ? <UpcomingDeliveriesPanel /> : null}
  {tab === 'banner' ? <BannerPanel /> : null}
        {tab === 'menu' ? <MenuTab /> : null}
        {tab === 'villages' ? <VillagesTab scope="delivery" /> : null}
        {tab === 'master-villages' ? <VillagesTab scope="master" /> : null}
        {tab === 'orders' ? <OrdersTab /> : null}
        {tab === 'catalog' ? <CatalogTab /> : null}
        {tab === 'customers' ? <CustomersTab api={customerApi} /> : null}
        {tab === 'gallery' ? <GalleryTab /> : null}
      </main>
    </div>
  )
}

/* ------------------------------ Delivery ------------------------------ */

function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

// Convert an ISO instant to a value for <input type="datetime-local"> in the
// browser's local time.
function toDateTimeLocal(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

// Given a Friday date string, return the following Saturday.
function nextDay(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function DeliveryTab() {
  const { data: menus } = useSWR<Menu[]>('/api/menus', fetcher)
  const active = menus?.find((m) => m.is_active) ?? null

  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [newName, setNewName] = useState('')
  const [newSale, setNewSale] = useState('')
  const [newSaleEnd, setNewSaleEnd] = useState('')
  const [newCutoff, setNewCutoff] = useState('')
  const [copyMenu, setCopyMenu] = useState(true)

  // `makeActive: false` saves the delivery for later; it appears in the
  // "Other deliveries" list with a "Make active" button when the time comes.
  async function createMenu(makeActive: boolean) {
    if (!newName.trim()) return
    setBusy(true)
    setMsg('')
    try {
      const previousId = active?.id ?? null
      const created = (await send('/api/menus', 'POST', {
        name: newName.trim(),
        sale_date: newSale || null,
        sale_date_end: newSaleEnd || null,
        cutoff_at: newCutoff ? new Date(newCutoff).toISOString() : null,
        activate: makeActive,
      })) as Menu

      // Optionally carry the previous delivery's menu across.
      if (copyMenu && previousId && created?.id) {
        const prev = (await fetcher(
          `/api/menu-items?menuId=${previousId}`,
        )) as MenuItemsResponse
        for (const it of prev.items ?? []) {
          await send('/api/menu-items', 'POST', {
            menu_id: created.id,
            name: it.name,
            category: it.category,
            description: it.description,
            price_cents: it.price_cents,
            sort_order: it.sort_order,
            is_seasonal: it.is_seasonal,
          })
        }
      }

      setNewName('')
      setNewSale('')
      setNewSaleEnd('')
      setNewCutoff('')
      setCreating(false)
      await mutate('/api/menus')
      await mutate('/api/menu-items')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteMenu(id: number, name: string) {
    if (
      !confirm(
        `Delete the delivery "${name}"? Its menu items are removed. Past orders are kept but will no longer be linked to a delivery. This can't be undone.`,
      )
    )
      return
    await send(`/api/menus?id=${id}`, 'DELETE')
    await mutate('/api/menus')
    await mutate('/api/menu-items')
  }

  async function activate(id: number) {
    await send('/api/menus', 'PATCH', { id, activate: true })
    await mutate('/api/menus')
    await mutate('/api/menu-items')
  }

  async function updateField(patch: Record<string, unknown>) {
    if (!active) return
    await send('/api/menus', 'PATCH', { id: active.id, ...patch })
    await mutate('/api/menus')
  }

  const open = isOrderingOpen(active)
  const range = formatDeliveryRange(
    active?.sale_date ?? null,
    active?.sale_date_end ?? null,
  )

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="Current delivery"
        action={
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-cream"
          >
            {creating ? 'Cancel' : 'New delivery'}
          </button>
        }
      />

      {creating ? (
        <div className="flex flex-col gap-3 rounded-md border border-brand-green/40 bg-card p-4">
          <Labeled label="Delivery name">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Late September Delivery"
              className={inputClass}
            />
          </Labeled>
          <div className="flex flex-wrap gap-3">
            <Labeled label="Friday" className="flex-1">
              <input
                type="date"
                value={newSale}
                onChange={(e) => {
                  setNewSale(e.target.value)
                  if (!newSaleEnd || newSaleEnd === nextDay(newSale))
                    setNewSaleEnd(nextDay(e.target.value))
                }}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Saturday" className="flex-1">
              <input
                type="date"
                value={newSaleEnd}
                onChange={(e) => setNewSaleEnd(e.target.value)}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Order cutoff" className="flex-1">
              <input
                type="datetime-local"
                value={newCutoff}
                onChange={(e) => setNewCutoff(e.target.value)}
                className={inputClass}
              />
            </Labeled>
          </div>
          {active ? (
            <label className="flex w-fit items-center gap-2 text-sm font-semibold text-brand-dark">
              <input
                type="checkbox"
                checked={copyMenu}
                onChange={(e) => setCopyMenu(e.target.checked)}
                className="h-4 w-4 accent-brand-green"
              />
              Copy the current menu across
            </label>
          ) : null}
          <p className="text-sm leading-relaxed text-brand-dark/70">
            Drop-off towns are copied from the master Drop-offs list.
          </p>
          {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => createMenu(true)}
              disabled={busy || !newName.trim()}
              className="flex-1 rounded-md bg-brand-green py-3 font-display text-lg font-bold text-brand-cream disabled:opacity-40"
            >
              {busy ? 'Creating…' : 'Create & make active'}
            </button>
            <button
              type="button"
              onClick={() => createMenu(false)}
              disabled={busy || !newName.trim()}
              className="flex-1 rounded-md border-2 border-brand-green py-3 font-display text-lg font-bold text-brand-green disabled:opacity-40"
            >
              {busy ? 'Creating…' : 'Create for later'}
            </button>
          </div>
          <p className="text-xs text-brand-dark/60">
            &ldquo;Create for later&rdquo; saves the delivery without switching
            the website to it. Find it under Other deliveries and press Make
            active when you&apos;re ready.
          </p>
        </div>
      ) : null}

      {active ? (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/50">
                Delivery name
              </span>
              <input
                key={active.id}
                defaultValue={active.name}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== active.name) updateField({ name: next })
                }}
                aria-label="Delivery name"
                className="-ml-2 w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-xl font-bold text-brand-dark outline-none hover:border-border focus:border-brand-green focus:bg-background"
              />
            </label>
            <span
              className={`mt-6 shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                open
                  ? 'bg-brand-green/15 text-brand-green'
                  : 'bg-muted text-brand-dark/70'
              }`}
            >
              {open ? 'Open' : 'Closed'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Labeled label="Friday" className="flex-1">
              <input
                type="date"
                key={`s-${active.id}`}
                defaultValue={toDateInput(active.sale_date)}
                onBlur={(e) => updateField({ sale_date: e.target.value || null })}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Saturday" className="flex-1">
              <input
                type="date"
                key={`e-${active.id}`}
                defaultValue={toDateInput(active.sale_date_end)}
                onBlur={(e) =>
                  updateField({ sale_date_end: e.target.value || null })
                }
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Order cutoff" className="flex-1">
              <input
                type="datetime-local"
                key={`c-${active.id}`}
                defaultValue={toDateTimeLocal(active.cutoff_at)}
                onBlur={(e) =>
                  updateField({
                    cutoff_at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className={inputClass}
              />
            </Labeled>
          </div>
          <p className="mt-2 text-xs text-brand-dark/50">
            Changes save when you tap away from a field.
          </p>

          {/* Master switch: controls what the public home page shows. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 px-4 py-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-brand-dark">
                Orders {active.orders_open ? 'on' : 'off'}
              </p>
              <p className="text-xs text-brand-dark/60">
                {active.orders_open
                  ? 'Customers can order now.'
                  : `Home page shows "opening soon"${range ? ` for ${range}` : ''}.`}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active.orders_open}
              aria-label="Orders on"
              onClick={() => updateField({ orders_open: !active.orders_open })}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                active.orders_open ? 'bg-brand-green' : 'bg-brand-dark/25'
              }`}
            >
              <span
                aria-hidden
                className={`absolute top-1 h-6 w-6 rounded-full bg-card shadow transition-all ${
                  active.orders_open ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {active.orders_open ? (
            <div className="mt-4">
              <SendReminderPanel api={customerApi} />
            </div>
          ) : null}

          {active.orders_open ? (
            <div className="mt-4">
              <LastCallPanel api={customerApi} />
            </div>
          ) : null}

          <div className="mt-4">
            <PickupReminderPanel api={customerApi} />
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-card p-6 text-center text-brand-dark/60">
          No active delivery yet. Create one to start taking orders.
        </p>
      )}

      {/* Past / other deliveries */}
      {menus && menus.filter((m) => !m.is_active).length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-dark/60">
            Other deliveries
          </h4>
          <div className="flex flex-col gap-2">
            {menus
              .filter((m) => !m.is_active)
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-brand-dark">
                      {m.name}
                    </div>
                    {m.sale_date ? (
                      <div className="text-xs text-brand-dark/60">
                        {formatDeliveryRange(m.sale_date, m.sale_date_end)}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => activate(m.id)}
                      className="rounded-md border border-brand-green px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-brand-green"
                    >
                      Make active
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${m.name}`}
                      onClick={() => deleteMenu(m.id, m.name)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-destructive hover:border-destructive"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------- Menu --------------------------------- */

type MenuItemsResponse = { menuId: number | null; items: MenuItem[] }
type CatalogEntry = {
  name: string
  category: string
  price_cents: number
  description: string
  is_seasonal: boolean
}
type CatalogResponse = { catalog: CatalogEntry[] }

function SeasonalTag() {
  return (
    <span className="inline-flex items-center rounded-sm bg-brand-yellow px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
      Seasonal
    </span>
  )
}

function MenuTab() {
  const { data } = useSWR<MenuItemsResponse>('/api/menu-items', fetcher)
  const { data: catalog } = useSWR<CatalogResponse>(
    '/api/menu-items?catalog=true',
    fetcher,
  )
  const menuId = data?.menuId ?? null
  const items = data?.items ?? []

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [seasonal, setSeasonal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function addItem(preset?: CatalogEntry) {
    if (!menuId) {
      setMsg('Create an active delivery first (Delivery tab).')
      return
    }
    const payload = preset
      ? { menu_id: menuId, ...preset }
      : {
          menu_id: menuId,
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          price_cents: Math.round(Number(price) * 100) || 0,
          is_seasonal: seasonal,
        }
    if (!payload.name) return
    setBusy(true)
    setMsg('')
    try {
      await send('/api/menu-items', 'POST', payload)
      if (!preset) {
        setName('')
        setDescription('')
        setPrice('')
        setSeasonal(false)
      }
      await mutate('/api/menu-items')
      await mutate('/api/menu-items?catalog=true')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id: number) {
    await send(`/api/menu-items?id=${id}`, 'DELETE')
    await mutate('/api/menu-items')
  }

  async function setSoldOut(id: number, soldOut: boolean) {
    await mutate<MenuItemsResponse>(
      '/api/menu-items',
      async (current) => {
        await send('/api/menu-items', 'PATCH', { id, sold_out: soldOut })
        return current
      },
      {
        optimisticData: (current) =>
          current
            ? {
                ...current,
                items: current.items.map((i) =>
                  i.id === id ? { ...i, is_sold_out: soldOut } : i,
                ),
              }
            : { menuId: null, items: [] },
        rollbackOnError: true,
        populateCache: false,
        revalidate: true,
      },
    )
  }

  // Permanently delete a product from the reusable catalog (not just this delivery).
  async function removeCatalogEntry(entryName: string) {
    if (
      !confirm(
        `Permanently remove "${entryName}" from your products? This can't be undone.`,
      )
    )
      return
    await send(
      `/api/menu-items?catalog=true&name=${encodeURIComponent(entryName)}`,
      'DELETE',
    )
    await mutate('/api/menu-items?catalog=true')
  }

  // Catalog entries not already on this delivery's menu.
  const onMenu = new Set(items.map((i) => i.name.toLowerCase()))
  const suggestions = (catalog?.catalog ?? []).filter(
    (c) => !onMenu.has(c.name.toLowerCase()),
  )

  const suggestionGroups = Object.entries(
    suggestions.reduce<Record<string, CatalogEntry[]>>((acc, c) => {
      const key = c.category || 'Other'
      ;(acc[key] ??= []).push(c)
      return acc
    }, {}),
  ).sort((a, b) => byCategoryOrder(a[0], b[0]))

  const itemGroups = Object.entries(
    items.reduce<Record<string, MenuItem[]>>((acc, c) => {
      const key = c.category || 'Other'
      ;(acc[key] ??= []).push(c)
      return acc
    }, {}),
  ).sort((a, b) => byCategoryOrder(a[0], b[0]))

  const existingCategories = Array.from(
    new Set(
      [
        ...CATEGORY_ORDER,
        ...[...(catalog?.catalog ?? []), ...items]
          .map((c) => c.category?.trim())
          .filter((c): c is string => Boolean(c)),
      ],
    ),
  ).sort(byCategoryOrder)

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="This delivery's menu" />

      {!menuId ? (
        <p className="rounded-md border border-dashed border-border bg-card p-6 text-center text-brand-dark/60">
          No active delivery. Create one in the Delivery tab first.
        </p>
      ) : (
        <>
          {/* Add new item */}
          <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
            <h3 className="font-display text-lg font-bold text-brand-dark">
              Add a product
            </h3>
            <div className="flex flex-wrap gap-3">
              <Labeled label="Name" className="min-w-40 flex-1">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cheeky Chorizo Sausage Rolls"
                  className={inputClass}
                />
              </Labeled>
              <Labeled label="Category" className="w-48">
                <input
                  list="product-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Pick or type…"
                  className={inputClass}
                />
                <datalist id="product-categories">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Labeled>
              <Labeled label="Price (€)" className="w-24">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </Labeled>
            </div>
            <Labeled label="Description (optional)">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Pork and chorizo. Smokey, sweet and spicy!"
                className={inputClass}
              />
            </Labeled>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-brand-dark">
              <input
                type="checkbox"
                checked={seasonal}
                onChange={(e) => setSeasonal(e.target.checked)}
                className="h-4 w-4 accent-brand-green"
              />
              Flavour of the season
              <SeasonalTag />
            </label>
            {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
            <button
              type="button"
              onClick={() => addItem()}
              disabled={busy || !name.trim()}
              className="rounded-md bg-brand-green py-3 font-display text-lg font-bold text-brand-cream disabled:opacity-40"
            >
              Add to menu
            </button>
          </div>

          {/* Reuse from catalog */}
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-brand-dark/60">
                Add a product from your list
              </h4>
              {suggestionGroups.map(([groupName, groupItems]) => (
                <div key={groupName} className="flex flex-col gap-2">
                  <h5 className="text-sm font-bold uppercase tracking-wide text-brand-green">
                    {groupName}
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {groupItems.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center rounded-full border border-border bg-background text-sm font-semibold text-brand-dark focus-within:border-brand-green hover:border-brand-green"
                      >
                        <button
                          type="button"
                          onClick={() => addItem(c)}
                          className="flex items-center gap-2 rounded-l-full py-2 pl-3 pr-2"
                        >
                          <span aria-hidden className="text-brand-green">
                            +
                          </span>
                          {c.name}
                          <span className="tabular-nums text-brand-dark/50">
                            {formatPrice(c.price_cents)}
                          </span>
                          {c.is_seasonal ? <SeasonalTag /> : null}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${c.name} from products`}
                          title="Remove from products"
                          onClick={() => removeCatalogEntry(c.name)}
                          className="flex h-full items-center rounded-r-full border-l border-border px-2.5 text-brand-dark/40 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <span aria-hidden className="text-base leading-none">
                            ×
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Current items */}
          <div className="flex flex-col gap-4">
            {items.length === 0 ? (
              <p className="py-6 text-center text-brand-dark/60">
                No items on the menu yet.
              </p>
            ) : (
              itemGroups.map(([groupName, groupItems]) => (
                <div key={groupName} className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-brand-green">
                    {groupName}
                    <span className="ml-2 font-normal text-brand-dark/40">
                      {groupItems.length}
                    </span>
                  </h3>
                  {groupItems.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      categories={existingCategories}
                      onSoldOut={(soldOut) => setSoldOut(item.id, soldOut)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// One item on this delivery's menu, with an Edit mode for name, category,
// price, description and seasonal tag. Orders always show the menu item's
// current name, so a rename here also updates existing orders.
function MenuItemRow({
  item,
  categories,
  onSoldOut,
  onRemove,
}: {
  item: MenuItem
  categories: string[]
  onSoldOut: (soldOut: boolean) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [price, setPrice] = useState((item.price_cents / 100).toFixed(2))
  const [description, setDescription] = useState(item.description)
  const [seasonal, setSeasonal] = useState(item.is_seasonal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function startEditing() {
    setName(item.name)
    setCategory(item.category)
    setPrice((item.price_cents / 100).toFixed(2))
    setDescription(item.description)
    setSeasonal(item.is_seasonal)
    setError('')
    setEditing(true)
  }

  async function save() {
    if (!name.trim()) {
      setError('The name can\'t be empty.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await send('/api/menu-items', 'PATCH', {
        id: item.id,
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        price_cents: Math.max(0, Math.round(Number(price) * 100) || 0),
        is_seasonal: seasonal,
      })
      await mutate('/api/menu-items')
      await mutate('/api/orders')
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-brand-green bg-card p-4">
        <div className="flex flex-wrap gap-3">
          <Labeled label="Name" className="min-w-40 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Category" className="w-48">
            <input
              list={`menu-item-categories-${item.id}`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            />
            <datalist id={`menu-item-categories-${item.id}`}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Labeled>
          <Labeled label="Price (€)" className="w-24">
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </Labeled>
        </div>
        <Labeled label="Description (optional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </Labeled>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={seasonal}
            onChange={(e) => setSeasonal(e.target.checked)}
            className="h-4 w-4 accent-brand-green"
          />
          Flavour of the season
          <SeasonalTag />
        </label>
        <p className="text-xs text-brand-dark/60">
          Changes apply to this delivery&apos;s menu and to orders already placed for
          it. To change it for future deliveries too, edit it in Products.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-cream disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-dark/70 hover:border-brand-dark/40"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-4 py-3',
        item.is_sold_out && 'bg-muted',
      )}
    >
      <div className="min-w-40 flex-1">
        <div
          className={cn(
            'font-semibold text-brand-dark',
            item.is_sold_out && 'text-brand-dark/50 line-through',
          )}
        >
          {item.name}
          <span className="ml-2 text-sm font-normal tabular-nums text-brand-dark/60">
            {formatPrice(item.price_cents)}
          </span>
          {item.is_seasonal ? (
            <span className="ml-2">
              <SeasonalTag />
            </span>
          ) : null}
        </div>
        {item.description ? (
          <div className="text-xs text-brand-dark/60">{item.description}</div>
        ) : null}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-dark/70">
        <input
          type="checkbox"
          checked={item.is_sold_out}
          onChange={(e) => onSoldOut(e.target.checked)}
          className="h-4 w-4 accent-destructive"
        />
        <span className={item.is_sold_out ? 'text-destructive' : undefined}>
          Sold out
        </span>
      </label>
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        onClick={startEditing}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-brand-green hover:border-brand-green"
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        onClick={onRemove}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-destructive hover:border-destructive"
      >
        Remove
      </button>
    </div>
  )
}

/* ----------------------------- Drop-offs ------------------------------ */

function VillagesTab({ scope }: { scope: 'master' | 'delivery' }) {
  const isMaster = scope === 'master'
  const listKey = isMaster ? '/api/villages?list=master' : '/api/villages?all=1'
  const { data: villages } = useSWR<Village[]>(listKey, fetcher)
  const { data: menus } = useSWR<Menu[]>(isMaster ? null : '/api/menus', fetcher)
  const activeMenu = menus?.find((m) => m.is_active)
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const [day, setDay] = useState<string>('Friday')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    await mutate(listKey)
    await mutate('/api/villages')
  }

  async function addVillage() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await send('/api/villages', 'POST', {
        name: name.trim(),
        pickup_time: time.trim(),
        delivery_day: day,
        list: isMaster ? 'master' : 'delivery',
      })
      setName('')
      setTime('')
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function patch(id: number, patchBody: Record<string, unknown>) {
    await send('/api/villages', 'PATCH', { id, ...patchBody })
    await refresh()
  }

  async function remove(id: number, villageName: string) {
    const message = isMaster
      ? `Remove ${villageName} from the master list? Existing deliveries keep their own copy.`
      : `Delete ${villageName} from this delivery? Past orders keep their history.`
    if (!confirm(message)) return
    await send(`/api/villages?id=${id}`, 'DELETE')
    await refresh()
  }

  if (!isMaster && menus && !activeMenu) {
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle title="Drop-offs for this delivery" />
        <p className="rounded-md border border-border bg-card p-4 text-brand-dark/80">
          There is no active delivery yet. Create one and it will start with
          the towns from the master Drop-offs list.
        </p>
      </div>
    )
  }

  const groups = Object.entries(
    (villages ?? []).reduce<Record<string, Village[]>>((acc, v) => {
      const key = v.delivery_day || 'Other'
      ;(acc[key] ??= []).push(v)
      return acc
    }, {}),
  ).sort((a, b) => byDayOrder(a[0], b[0]))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <SectionTitle
          title={isMaster ? 'Master drop-off list' : 'Drop-offs for this delivery'}
        />
        <p className="text-pretty leading-relaxed text-brand-dark/70">
          {isMaster
            ? 'Every new delivery starts with a copy of these towns. Changes here affect deliveries you create from now on, not existing ones.'
            : `These towns apply only to ${activeMenu?.name ?? 'the active delivery'}. To change the towns future deliveries start with, use the Drop-offs tab at the top.`}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
        <h3 className="font-display text-lg font-bold text-brand-dark">
          Add a town
        </h3>
        <div className="flex flex-wrap gap-3">
          <Labeled label="Town" className="min-w-40 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Civray"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Day" className="w-36">
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className={inputClass}
            >
              {DELIVERY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Approx. time" className="w-32">
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g. 10:45"
              className={inputClass}
            />
          </Labeled>
        </div>
        <button
          type="button"
          onClick={addVillage}
          disabled={busy || !name.trim()}
          className="rounded-md bg-brand-green py-3 font-display text-lg font-bold text-brand-cream disabled:opacity-40"
        >
          Add town
        </button>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {groups.map(([groupDay, list]) => (
        <div key={groupDay} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-green">
            {groupDay}
            <span className="ml-2 font-normal text-brand-dark/40">
              {list.length} {list.length === 1 ? 'stop' : 'stops'}
            </span>
          </h3>
          {list.map((v) => (
            <div
              key={v.id}
              className={`flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3 ${
                v.is_active ? 'border-border' : 'border-dashed border-border opacity-70'
              }`}
            >
              <input
                defaultValue={v.name}
                aria-label="Town name"
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== v.name &&
                  patch(v.id, { name: e.target.value.trim() })
                }
                className="min-w-32 flex-1 rounded-md border border-input bg-background px-3 py-2 font-semibold text-brand-dark outline-none focus:border-brand-green"
              />
              <select
                value={v.delivery_day || ''}
                aria-label="Delivery day"
                onChange={(e) => patch(v.id, { delivery_day: e.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-green"
              >
                {DELIVERY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                key={`${v.id}-${v.pickup_time}`}
                defaultValue={v.pickup_time}
                aria-label="Approximate time"
                placeholder="Time"
                onBlur={(e) =>
                  e.target.value !== v.pickup_time &&
                  patch(v.id, { pickup_time: e.target.value.trim() })
                }
                className="w-24 rounded-md border border-input bg-background px-3 py-2 tabular-nums text-brand-dark outline-none focus:border-brand-green"
              />
              <button
                type="button"
                onClick={() => patch(v.id, { is_active: !v.is_active })}
                className={`rounded-md px-3 py-2 text-sm font-bold uppercase tracking-wide ${
                  v.is_active
                    ? 'bg-brand-green/15 text-brand-green'
                    : 'bg-muted text-brand-dark/70'
                }`}
              >
                {v.is_active ? 'Active' : 'Hidden'}
              </button>
              <button
                type="button"
                aria-label={`Delete ${v.name}`}
                onClick={() => remove(v.id, v.name)}
                className="rounded-md border border-border px-3 py-2 text-sm font-bold uppercase tracking-wide text-destructive hover:border-destructive"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ----------------------------- Products ------------------------------- */

function CatalogTab() {
  const { data } = useSWR<CatalogResponse>(
    '/api/menu-items?catalog=true',
    fetcher,
  )
  // Current delivery's menu, so each product can show "Add to menu" or "On menu".
  const { data: menuData } = useSWR<MenuItemsResponse>('/api/menu-items', fetcher)
  const menuId = menuData?.menuId ?? null
  const onMenuNames = new Set(
    (menuData?.items ?? []).map((it) => it.name.trim().toLowerCase()),
  )
  const entries = data?.catalog ?? []

  const groups = Object.entries(
    entries.reduce<Record<string, CatalogEntry[]>>((acc, c) => {
      const key = c.category || 'Other'
      ;(acc[key] ??= []).push(c)
      return acc
    }, {}),
  ).sort((a, b) => byCategoryOrder(a[0], b[0]))

  const existingCategories = Array.from(
    new Set([
      ...CATEGORY_ORDER,
      ...(entries.map((c) => c.category?.trim()).filter(Boolean) as string[]),
    ]),
  ).sort(byCategoryOrder)

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="Products" />
      <p className="-mt-2 text-sm text-brand-dark/60">
        Every product you&apos;ve ever added lives here. Edit a name, category,
        description or price — changes apply the next time you add it to a
        menu. Editing here does not change a product already on the current
        delivery&apos;s menu. Use <strong>Add to menu</strong> to put a product
        back on the current delivery.
      </p>

      <datalist id="catalog-categories">
        {existingCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card p-6 text-center text-brand-dark/60">
          No products yet. Add them from the Menu tab and they&apos;ll appear
          here.
        </p>
      ) : (
        groups.map(([groupName, groupItems]) => (
          <div key={groupName} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-brand-green">
                {groupName}
              </h3>
              <span className="text-xs text-brand-dark/40">
                {groupItems.length}{' '}
                {groupItems.length === 1 ? 'product' : 'products'}
              </span>
            </div>
            {groupItems
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((entry) => (
                <CatalogRow
                  key={entry.name}
                  entry={entry}
                  menuId={menuId}
                  onMenu={onMenuNames.has(entry.name.trim().toLowerCase())}
                />
              ))}
          </div>
        ))
      )}
    </div>
  )
}

function CatalogRow({
  entry,
  menuId,
  onMenu,
}: {
  entry: CatalogEntry
  menuId: number | null
  onMenu: boolean
}) {
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  async function addToMenu() {
    if (!menuId) {
      setError('Create an active delivery first (Delivery tab).')
      return
    }
    setError('')
    setAdding(true)
    try {
      await send('/api/menu-items', 'POST', { menu_id: menuId, ...entry })
      await mutate('/api/menu-items')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function save(patchBody: Partial<CatalogEntry>) {
    setError('')
    try {
      await send('/api/menu-items', 'PATCH', {
        catalog: true,
        originalName: entry.name,
        name: entry.name,
        category: entry.category,
        description: entry.description,
        price_cents: entry.price_cents,
        is_seasonal: entry.is_seasonal,
        ...patchBody,
      })
      await mutate('/api/menu-items?catalog=true')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove() {
    if (
      !confirm(
        `Permanently remove "${entry.name}" from your products? This can't be undone.`,
      )
    )
      return
    await send(
      `/api/menu-items?catalog=true&name=${encodeURIComponent(entry.name)}`,
      'DELETE',
    )
    await mutate('/api/menu-items?catalog=true')
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          defaultValue={entry.name}
          aria-label="Product name"
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next && next !== entry.name) save({ name: next })
          }}
          className="min-w-40 flex-1 rounded-md border border-input bg-background px-3 py-2 font-semibold text-brand-dark outline-none focus:border-brand-green"
        />
        <input
          list="catalog-categories"
          defaultValue={entry.category}
          aria-label="Category"
          placeholder="Category"
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next !== entry.category) save({ category: next })
          }}
          className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-green"
        />
        <div className="flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand-green">
          <span className="text-brand-dark/50">€</span>
          <input
            type="number"
            step="0.05"
            min="0"
            defaultValue={(entry.price_cents / 100).toFixed(2)}
            aria-label="Price in euros"
            onBlur={(e) => {
              const cents = Math.max(0, Math.round(Number(e.target.value) * 100))
              if (cents !== entry.price_cents) save({ price_cents: cents })
            }}
            className="w-16 bg-transparent text-right tabular-nums text-brand-dark outline-none"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={entry.is_seasonal}
            onChange={(e) => save({ is_seasonal: e.target.checked })}
            className="h-4 w-4 accent-brand-green"
          />
          Seasonal
        </label>
        {onMenu ? (
          <span className="rounded-md border border-brand-green/30 bg-brand-green/10 px-3 py-2 text-sm font-bold uppercase tracking-wide text-brand-green">
            On menu
          </span>
        ) : (
          <button
            type="button"
            onClick={addToMenu}
            disabled={adding}
            aria-label={`Add ${entry.name} to the current menu`}
            className="rounded-md bg-brand-green px-3 py-2 text-sm font-bold uppercase tracking-wide text-brand-cream transition-colors hover:bg-brand-green-dark disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add to menu'}
          </button>
        )}
        <button
          type="button"
          aria-label={`Delete ${entry.name}`}
          onClick={remove}
          className="rounded-md border border-border px-3 py-2 text-sm font-bold uppercase tracking-wide text-destructive hover:border-destructive"
        >
          Delete
        </button>
      </div>
      <input
        defaultValue={entry.description}
        aria-label="Description"
        placeholder="Description shown to customers"
        onBlur={(e) => {
          const next = e.target.value.trim()
          if (next !== entry.description) save({ description: next })
        }}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-green"
      />
      {error ? (
        <p className="text-sm font-semibold text-destructive">{error}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------ Orders -------------------------------- */

type OrdersResponse = { menuId: number | null; orders: Order[] }
type OrderView = 'totals' | 'make' | 'village' | 'person'

// Ticks lines straight away on screen, then saves and reloads the orders.
async function setAllocation(
  body: { id: number } | { menu_item_id: number; flavour_item_id: number | null },
  matches: (it: OrderItem) => boolean,
  isAllocated: boolean,
) {
  try {
    await mutate<OrdersResponse>(
      '/api/orders',
      async (current) => {
        await send('/api/order-items', 'PATCH', { ...body, is_allocated: isAllocated })
        return current
      },
      {
        optimisticData: (current) =>
          ({
            ...current,
            orders: (current?.orders ?? []).map((o) => ({
              ...o,
              items: o.items.map((it) =>
                matches(it) ? { ...it, is_allocated: isAllocated } : it,
              ),
            })),
          }) as OrdersResponse,
        populateCache: false,
        revalidate: true,
        rollbackOnError: true,
      },
    )
  } catch (err) {
    alert((err as Error).message)
  }
}

function OrdersTab() {
  const { data } = useSWR<OrdersResponse>('/api/orders', fetcher, {
    refreshInterval: 20_000,
  })
  const { data: menus } = useSWR<Menu[]>('/api/menus', fetcher)
  const [view, setView] = useState<OrderView>('totals')
  const [personSort, setPersonSort] = useState<'name' | 'newest'>('name')
  const [printMode, setPrintMode] = useState<'run' | 'newest'>('run')
  const [adding, setAdding] = useState(false)
  const orders = data?.orders ?? []
  const active = menus?.find((m) => m.is_active) ?? null

  // Browsers fire afterprint once the dialog closes (on mobile window.print() doesn't block).
  useEffect(() => {
    const reset = () => setPrintMode('run')
    window.addEventListener('afterprint', reset)
    return () => window.removeEventListener('afterprint', reset)
  }, [])

  function printAs(mode: 'run' | 'newest') {
    flushSync(() => setPrintMode(mode))
    window.print()
  }

  const newestFirst = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [orders],
  )

  function sectionClass(visibleOnScreen: boolean): string {
    const printed = printMode === 'run' ? 'print:block' : 'print:hidden'
    return visibleOnScreen ? (printMode === 'run' ? '' : 'print:hidden') : `hidden ${printed}`
  }

  // Production totals: sum quantities per item name across all orders,
  // grouped by meat mix so Bob can see how much of each mix to make.
  const makeTotals = useMemo(() => {
    const totals = new Map<
      string,
      { label: string; name: string; flavour_name: string | null; qty: number; cents: number }
    >()
    for (const o of orders) {
      for (const it of o.items) {
        const label = orderItemLabel(it)
        const cur = totals.get(label) ?? {
          label,
          name: it.name,
          flavour_name: it.flavour_name ?? null,
          qty: 0,
          cents: 0,
        }
        cur.qty += it.quantity
        cur.cents += it.price_cents * it.quantity
        totals.set(label, cur)
      }
    }
    return groupByMeat(Array.from(totals.values()), (t) => t)
  }, [orders])

  // What still needs making: totals minus lines already allocated from stock.
  const toMake = useMemo(() => {
    const left = new Map<
      string,
      {
        key: string
        name: string
        itemName: string
        flavour_name: string | null
        qty: number
        menuItemId: number
        flavourId: number | null
      }
    >()
    for (const o of orders) {
      for (const it of o.items) {
        if (it.is_allocated) continue
        const key = lineKey(it.menu_item_id, it.flavour_item_id)
        const cur = left.get(key) ?? {
          key,
          name: orderItemLabel(it),
          itemName: it.name,
          flavour_name: it.flavour_name ?? null,
          qty: 0,
          menuItemId: it.menu_item_id,
          flavourId: it.flavour_item_id ?? null,
        }
        cur.qty += it.quantity
        left.set(key, cur)
      }
    }
    return groupByMeat(Array.from(left.values()), (t) => ({
      name: t.itemName,
      flavour_name: t.flavour_name,
    }))
  }, [orders])

  // Group by delivery day, then by town in route order (time then name).
  const byDay = useMemo(() => {
    const days = new Map<string, Map<string, Order[]>>()
    for (const o of orders) {
      const dayKey = o.delivery_day || 'Unassigned'
      const townKey = o.village_name ?? 'Unassigned'
      const towns = days.get(dayKey) ?? new Map<string, Order[]>()
      const arr = towns.get(townKey) ?? []
      arr.push(o)
      towns.set(townKey, arr)
      days.set(dayKey, towns)
    }
    return Array.from(days.entries())
      .sort((a, b) => byDayOrder(a[0], b[0]))
      .map(([dayKey, towns]) => [
        dayKey,
        Array.from(towns.entries()).sort((a, b) => {
          const ta = a[1][0]?.pickup_time ?? ''
          const tb = b[1][0]?.pickup_time ?? ''
          if (ta && tb && ta !== tb) return ta.localeCompare(tb)
          return a[0].localeCompare(b[0])
        }),
      ]) as [string, [string, Order[]][]][]
  }, [orders])

  const orderCount = orders.length
  // Orders from someone who has ordered more than once for this delivery.
  const duplicates = useMemo(() => findDuplicates(orders), [orders])
  const identicalCount = Array.from(duplicates.values()).filter(
    (k) => k === 'identical',
  ).length
  const grandTotal = orders.reduce((s, o) => s + orderTotal(o), 0)
  const range = formatDeliveryRange(
    active?.sale_date ?? null,
    active?.sale_date_end ?? null,
  )

  function dayDate(day: string): string {
    const date = deliveryDateFor(active ?? null, day)
    return date ? formatSaleDate(date) : ''
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">
        <SectionTitle
          title="Orders"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding((a) => !a)}
                disabled={!active}
                className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-cream transition-colors hover:bg-brand-green-dark disabled:opacity-50"
              >
                {adding ? 'Close' : 'Add order'}
              </button>
              <button
                type="button"
                onClick={() => printAs('run')}
                className="rounded-md bg-brand-dark px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-cream"
              >
                Print delivery run
              </button>
              <button
                type="button"
                onClick={() => printAs('newest')}
                disabled={orderCount === 0}
                className="rounded-md border-2 border-brand-dark px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-brand-dark transition-colors hover:bg-brand-dark hover:text-brand-cream disabled:opacity-50"
              >
                Print newest first
              </button>
            </div>
          }
        />
      </div>

      {adding && active ? (
        <div className="print:hidden">
          <ManualOrderForm onDone={() => setAdding(false)} />
        </div>
      ) : null}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <Stat label="Orders" value={String(orderCount)} />
        <Stat label="Total value" value={formatPrice(grandTotal)} />
      </div>

      {/* View switch */}
      <div className="flex gap-1 rounded-md bg-muted p-1 print:hidden">
        {(
          [
            ['totals', 'Totals'],
            ['make', 'To make'],
            ['village', 'By town'],
            ['person', 'By person'],
          ] as [OrderView, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
              view === id ? 'bg-card text-brand-green shadow-sm' : 'text-brand-dark/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <h1 className="font-display text-2xl font-bold text-brand-dark">
          {printMode === 'newest' ? 'Orders, newest first' : 'Delivery run'} —{' '}
          {active?.name ?? 'Magnificent Sausage Rolls'}
        </h1>
        {range ? <p className="text-brand-dark/70">{range}</p> : null}
        {printMode === 'newest' ? (
          <p className="text-brand-dark/70">
            {orderCount} {orderCount === 1 ? 'order' : 'orders'} · {formatPrice(grandTotal)}
          </p>
        ) : null}
      </div>

      {printMode === 'newest' && orderCount > 0 ? (
        <div className="hidden print:block">
          {newestFirst.map((o) => (
            <div
              key={o.id}
              className="mb-2 overflow-hidden rounded-md border border-border bg-card print:break-inside-avoid"
            >
              <OrderRow order={o} showVillage showTime duplicate={duplicates.get(o.id)} />
            </div>
          ))}
        </div>
      ) : null}

      {duplicates.size > 0 ? (
        <p
          role="status"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-brand-dark print:hidden"
        >
          <strong>{duplicates.size} orders</strong> come from people who ordered more than
          once for this delivery
          {identicalCount > 0 ? (
            <>
              , including <strong>{identicalCount} with identical items</strong>
            </>
          ) : null}
          . They&rsquo;re marked in the By town and By person lists so you can check before packing.
        </p>
      ) : null}

      {orderCount === 0 ? (
        <p className="py-10 text-center text-brand-dark/60">
          No orders yet for this delivery.
        </p>
      ) : (
        <>
          {/* TOTALS (default) — also always printed first */}
          <div className={sectionClass(view === 'totals')}>
            <h2 className="mb-2 font-display text-lg font-bold text-brand-dark">
              Totals
            </h2>
            <div className="flex flex-col gap-3">
              {makeTotals.map((group) => (
                <div key={group.key || 'other'} className="break-inside-avoid">
                  <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
                    {group.label}
                  </h3>
                  <div className="overflow-hidden rounded-md border border-border bg-card">
                    {group.rows.map((t, i) => (
                      <div
                        key={t.label}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i > 0 ? 'border-t border-border' : ''
                        }`}
                      >
                        <span className="font-semibold text-brand-dark">{t.label}</span>
                        <span className="flex items-center gap-4">
                          <span className="font-display text-2xl font-bold tabular-nums text-brand-green">
                            {t.qty}
                          </span>
                          <span className="w-20 text-right text-sm tabular-nums text-brand-dark/60">
                            {formatPrice(t.cents)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TO MAKE — totals minus what's allocated from stock */}
          <div className={sectionClass(view === 'make')}>
            <h2 className="font-display text-lg font-bold text-brand-dark print:mt-6">
              To make
            </h2>
            <p className="mb-2 text-sm text-brand-dark/60 print:hidden">
              Totals minus anything already ticked off from stock. Tick an item once
              it&apos;s made and it&apos;s allocated to everyone who ordered it.
            </p>
            {toMake.length === 0 ? (
              <p className="rounded-md border border-border bg-card px-4 py-6 text-center text-brand-dark/60">
                Nothing left to make. Every item is allocated.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {toMake.map((group) => (
                  <div key={group.key || 'other'} className="break-inside-avoid">
                    <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-green">
                      {group.label}
                    </h3>
                    <div className="overflow-hidden rounded-md border border-border bg-card">
                      {group.rows.map((t, i) => (
                        <label
                          key={t.key}
                          className={cn(
                            'flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60',
                            i > 0 && 'border-t border-border',
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() =>
                                setAllocation(
                                  { menu_item_id: t.menuItemId, flavour_item_id: t.flavourId },
                                  (it) =>
                                    it.menu_item_id === t.menuItemId &&
                                    (it.flavour_item_id ?? null) === t.flavourId,
                                  true,
                                )
                              }
                              aria-label={`Mark all ${t.qty} ${t.name} as made`}
                              className="h-5 w-5 cursor-pointer accent-brand-green"
                            />
                            <span className="font-semibold text-brand-dark">{t.name}</span>
                          </span>
                          <span className="font-display text-2xl font-bold tabular-nums text-brand-green">
                            {t.qty}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BY TOWN — the delivery run; always printed */}
          <div className={sectionClass(view === 'village')}>
            {byDay.map(([dayKey, towns]) => (
              <div key={dayKey} className="mb-6">
                <h2 className="mb-2 mt-4 flex items-baseline gap-2 border-b-2 border-brand-yellow pb-1 font-display text-lg font-bold text-brand-dark print:mt-6">
                  {dayKey}
                  {dayDate(dayKey) ? (
                    <span className="text-sm font-normal text-brand-dark/60">
                      {dayDate(dayKey)}
                    </span>
                  ) : null}
                </h2>
                <div className="flex flex-col gap-4">
                  {towns.map(([town, group]) => (
                    <div
                      key={town}
                      className="overflow-hidden rounded-md border border-border bg-card print:break-inside-avoid"
                    >
                      <div className="flex items-center justify-between bg-brand-yellow px-4 py-2">
                        <h3 className="font-display text-lg font-bold text-brand-dark">
                          {town}
                        </h3>
                        {group[0]?.pickup_time ? (
                          <span className="font-bold tabular-nums text-brand-dark">
                            {group[0].pickup_time}
                          </span>
                        ) : null}
                      </div>
                      {group.map((o) => (
                        <OrderRow key={o.id} order={o} duplicate={duplicates.get(o.id)} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* BY PERSON */}
          {view === 'person' ? (
            <div className="flex flex-col gap-3 print:hidden">
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-brand-dark/60">Sort by</span>
                <div
                  role="group"
                  aria-label="Sort orders"
                  className="flex gap-1 rounded-md bg-muted p-1"
                >
                  {(
                    [
                      ['name', 'Name (A–Z)'],
                      ['newest', 'Newest first'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={personSort === id}
                      onClick={() => setPersonSort(id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                        personSort === id
                          ? 'bg-card text-brand-green shadow-sm'
                          : 'text-brand-dark/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {[...orders]
                  .sort((a, b) =>
                    personSort === 'newest'
                      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      : a.customer_name.localeCompare(b.customer_name),
                  )
                  .map((o) => (
                    <div
                      key={o.id}
                      className="overflow-hidden rounded-md border border-border bg-card"
                    >
                      <OrderRow
                        order={o}
                        showVillage
                        showTime={personSort === 'newest'}
                        duplicate={duplicates.get(o.id)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function OrderRow({
  order,
  showVillage,
  showTime,
  duplicate,
}: {
  order: Order
  showVillage?: boolean
  showTime?: boolean
  // Set when the same person has another order for this delivery.
  duplicate?: DuplicateKind
}) {
  const [editing, setEditing] = useState(false)

  async function remove() {
    if (!confirm(`Delete ${order.customer_name}'s order?`)) return
    await send(`/api/orders/${order.id}`, 'DELETE')
    await mutate('/api/orders')
  }

  const [savingNew, setSavingNew] = useState(false)
  async function toggleNewCustomer(next: boolean) {
    setSavingNew(true)
    try {
      await send(`/api/orders/${order.id}`, 'PATCH', { is_new_customer: next })
      await mutate('/api/orders')
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSavingNew(false)
    }
  }

  if (editing) {
    return (
      <div className="border-t border-border p-3 first:border-t-0 print:hidden">
        <ManualOrderForm order={order} onDone={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-brand-dark">
            {order.customer_name}
            {order.is_new_customer ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-green px-2.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wide text-brand-cream print:rounded-sm print:border print:border-brand-green print:bg-transparent print:px-1.5 print:text-brand-green">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                New customer
              </span>
            ) : null}
            {duplicate ? (
              <span
                title={
                  duplicate === 'identical'
                    ? 'This person has another order for this delivery with exactly the same items'
                    : 'This person has another order for this delivery'
                }
                className={cn(
                  'ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wide print:rounded-sm print:border print:bg-transparent print:px-1.5',
                  duplicate === 'identical'
                    ? 'bg-destructive text-white print:border-destructive print:text-destructive'
                    : 'border border-destructive/60 text-destructive',
                )}
              >
                {duplicate === 'identical' ? 'Identical order' : 'Possible duplicate'}
              </span>
            ) : null}
            {showVillage && order.village_name ? (
              <span className="ml-2 text-sm font-normal text-brand-dark/60">
                · {order.village_name}
                {order.delivery_day ? ` (${order.delivery_day}` : ''}
                {order.delivery_day && order.pickup_time
                  ? ` ${order.pickup_time})`
                  : order.delivery_day
                    ? ')'
                    : ''}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-brand-dark/50">
            {showTime && order.created_at ? (
              <time dateTime={order.created_at} className="font-semibold text-brand-dark/70">
                {new Date(order.created_at).toLocaleString('en-GB', {
                  timeZone: 'Europe/Paris',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            ) : null}
            {order.email ? <span>{order.email}</span> : <span>No email</span>}
            {order.source && order.source !== 'website' ? (
              <span className="rounded-sm bg-brand-yellow/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                {SOURCE_LABELS[order.source] ?? order.source}
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 font-display text-lg font-bold tabular-nums text-brand-dark">
          {formatPrice(orderTotal(order))}
        </span>
      </div>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-brand-dark/80">
        {order.items.map((it) => (
          <li key={it.id}>
            <label
              className={cn(
                '-mx-1.5 flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 tabular-nums transition-colors',
                it.is_allocated
                  ? 'bg-brand-green/10 text-brand-green'
                  : 'hover:bg-muted/60',
              )}
            >
              <input
                type="checkbox"
                checked={it.is_allocated}
                onChange={(e) =>
                  setAllocation({ id: it.id }, (x) => x.id === it.id, e.target.checked)
                }
                aria-label={`${orderItemLabel(it)} allocated`}
                className="h-4 w-4 shrink-0 cursor-pointer accent-brand-green"
              />
              <span>
                {it.quantity} × {orderItemLabel(it)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {order.notes ? (
        <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs text-brand-dark/70">
          Note: {order.notes}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-4 print:hidden">
  <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-bold uppercase tracking-wide text-brand-green"
        >
          Edit order
        </button>
        <button
          type="button"
          onClick={remove}
          className="text-xs font-bold uppercase tracking-wide text-destructive"
        >
          Delete order
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-dark/70 has-[:disabled]:opacity-60">
          <input
            type="checkbox"
            checked={order.is_new_customer}
            disabled={savingNew}
            onChange={(e) => toggleNewCustomer(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-brand-green"
          />
          New customer
        </label>
      </div>
    </div>
  )
}

/* --------------------------- Manual orders ----------------------------- */

function QtyRow({
  label,
  price,
  hint,
  value,
  onChange,
}: {
  label: string
  price?: string
  hint?: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0 truncate text-sm font-semibold text-brand-dark">
        {label}
        {price ? (
          <span className="ml-2 text-xs font-normal tabular-nums text-brand-dark/60">
            {price}
          </span>
        ) : null}
        {hint ? (
          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label}`}
          onClick={() => onChange(value - 1)}
          className="h-8 w-8 rounded-md border border-border text-brand-dark hover:bg-muted"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${label} quantity`}
          className="h-8 w-12 rounded-md border border-input bg-background text-center text-sm tabular-nums text-brand-dark outline-none focus:border-brand-green"
        />
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-md border border-border text-brand-dark hover:bg-muted"
        >
          +
        </button>
      </div>
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  email: 'Email',
  messenger: 'Messenger',
  phone: 'Phone',
  in_person: 'In person',
}

// Lets the owner key in an order that arrived by email, Messenger, phone or
// in person. Posts to the same endpoint customers use; the manager PIN
// unlocks the relaxed rules (no cutoff, optional email).
// Passing an existing `order` turns it into the edit form for that order.
function ManualOrderForm({
  onDone,
  order,
}: {
  onDone: () => void
  order?: Order
}) {
  const isEdit = !!order
  const { data: menuData } = useSWR<MenuItemsResponse>('/api/menu-items', fetcher)
  const { data: villages } = useSWR<Village[]>('/api/villages', fetcher)
  const [name, setName] = useState(order?.customer_name ?? '')
  const [email, setEmail] = useState(order?.email ?? '')
  const [source, setSource] = useState<string>(order?.source ?? 'messenger')
  const [villageId, setVillageId] = useState(
    order?.village_id ? String(order.village_id) : '',
  )
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [isNewCustomer, setIsNewCustomer] = useState(
    order?.is_new_customer ?? false,
  )
  // Keyed by lineKey so sausage meat can hold one quantity per flavour.
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (order?.items ?? []).map((it) => [
        lineKey(it.menu_item_id, it.flavour_item_id),
        it.quantity,
      ]),
    ),
  )
  const [addToList, setAddToList] = useState(false)
  const [sendConfirmation, setSendConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const items = menuData?.items ?? []
  const byCategory = useMemo(() => {
    const groups = new Map<string, MenuItem[]>()
    for (const it of items) {
      const arr = groups.get(it.category) ?? []
      arr.push(it)
      groups.set(it.category, arr)
    }
    return Array.from(groups.entries())
  }, [items])

  const meatFlavours = items.filter(isMeatFlavour)
  const itemsById = new Map(items.map((it) => [it.id, it]))
  const lines = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .flatMap(([key, quantity]) => {
      const [menuPart, flavourPart] = key.split(':')
      const item = itemsById.get(Number(menuPart))
      if (!item) return []
      const flavourId = flavourPart ? Number(flavourPart) : null
      return [{ item, flavourId, quantity }]
    })
  const total = lines.reduce(
    (s, l) => s + l.item.price_cents * l.quantity,
    0,
  )
  const linePayload = lines.map((l) => ({
    menu_item_id: l.item.id,
    flavour_item_id: l.flavourId,
    quantity: l.quantity,
  }))

  function setItemQty(id: string, next: number) {
    setQty((q) => {
      const clamped = Math.max(0, Math.min(99, Math.round(next)))
      const copy = { ...q }
      if (clamped === 0) delete copy[id]
      else copy[id] = clamped
      return copy
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved('')
    if (!name.trim()) return setError('Enter the customer’s name.')
    if (!villageId) return setError('Choose a drop-off town.')
    if (lines.length === 0) return setError('Add at least one item.')
    setBusy(true)
    try {
      if (order) {
        await send(`/api/orders/${order.id}`, 'PATCH', {
          customer_name: name.trim(),
          email: email.trim(),
          village_id: Number(villageId),
          notes: notes.trim(),
          is_new_customer: isNewCustomer,
          source,
          send_confirmation: sendConfirmation && !!email.trim(),
          items: linePayload,
        })
        await mutate('/api/orders')
        onDone()
        return
      }
      await send('/api/orders', 'POST', {
        customer_name: name.trim(),
        email: email.trim(),
        village_id: Number(villageId),
        notes: notes.trim(),
        is_new_customer: isNewCustomer,
        source,
        marketing_consent: addToList && !!email.trim(),
        send_confirmation: sendConfirmation && !!email.trim(),
        items: linePayload,
      })
      await mutate('/api/orders')
      setSaved(`Saved ${name.trim()}’s order (${formatPrice(total)}).`)
      setName('')
      setEmail('')
      setNotes('')
      setIsNewCustomer(false)
      setQty({})
      setAddToList(false)
      setSendConfirmation(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sortedVillages = (villages ?? [])
    .filter((v) => v.is_active || v.id === order?.village_id)
    .sort((a, b) => {
      const d = byDayOrder(a.delivery_day, b.delivery_day)
      if (d !== 0) return d
      return (a.pickup_time ?? '').localeCompare(b.pickup_time ?? '')
    })

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-md border-2 border-brand-green/40 bg-card p-4"
    >
      <div>
        <h3 className="font-display text-lg font-bold text-brand-dark">
          {isEdit ? `Edit ${order.customer_name}’s order` : 'Add an order by hand'}
        </h3>
        <p className="text-sm text-brand-dark/60">
          {isEdit
            ? 'Change anything the customer asked for, then save. Works even after ordering has closed.'
            : 'For orders that came in by email, Messenger, phone or in person. Works even when ordering is closed.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Customer name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Email (optional)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Leave blank if you don’t have one"
            className={inputClass}
          />
        </Labeled>
        <Labeled label="How did they order?">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={inputClass}
          >
            {isEdit && order.source === 'website' ? (
              <option value="website">Website</option>
            ) : null}
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Drop-off town">
          <select
            value={villageId}
            onChange={(e) => setVillageId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Choose a town…</option>
            {sortedVillages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.delivery_day}
                {v.pickup_time ? ` ${v.pickup_time}` : ''}
              </option>
            ))}
          </select>
        </Labeled>
      </div>

      <div className="flex flex-col gap-3">
        {byCategory.map(([category, catItems]) => (
          <div key={category}>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-dark/60">
              {category}
            </div>
            <div className="divide-y divide-border rounded-md border border-border">
              {catItems.map((it) => {
                if (isSausageMeat(it)) {
                  const plainKey = lineKey(it.id, null)
                  return (
                    <div key={it.id} className="px-3 py-2">
                      <div className="text-sm font-semibold text-brand-dark">
                        {it.name}
                        <span className="ml-2 text-xs font-normal tabular-nums text-brand-dark/60">
                          {formatPrice(it.price_cents)} per pack · choose flavours
                        </span>
                      </div>
                      <div className="mt-1 flex flex-col divide-y divide-border border-l-2 border-brand-green/30 pl-3">
                        {(qty[plainKey] ?? 0) > 0 ? (
                          <QtyRow
                            label="Flavour not chosen"
                            value={qty[plainKey]}
                            onChange={(n) => setItemQty(plainKey, n)}
                          />
                        ) : null}
                        {meatFlavours.map((f) => {
                          const key = lineKey(it.id, f.id)
                          return (
                            <QtyRow
                              key={f.id}
                              label={flavourLabel(f.name)}
                              hint={f.is_sold_out ? 'Sold out' : undefined}
                              value={qty[key] ?? 0}
                              onChange={(n) => setItemQty(key, n)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                const key = lineKey(it.id, null)
                return (
                  <div key={it.id} className="px-3 py-2">
                    <QtyRow
                      label={it.name}
                      price={formatPrice(it.price_cents)}
                      value={qty[key] ?? 0}
                      onChange={(n) => setItemQty(key, n)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Labeled label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </Labeled>

      <div className="flex flex-col gap-2 text-sm text-brand-dark">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isNewCustomer}
            onChange={(e) => setIsNewCustomer(e.target.checked)}
            className="h-4 w-4 accent-brand-green"
          />
          New customer (shows on the delivery run so Bob knows)
        </label>
        {isEdit ? null : (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={addToList}
              disabled={!email.trim()}
              onChange={(e) => setAddToList(e.target.checked)}
              className="h-4 w-4 accent-brand-green"
            />
            Add to the reminder list (they&apos;ve said yes to emails)
          </label>
        )}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={sendConfirmation}
            disabled={!email.trim()}
            onChange={(e) => setSendConfirmation(e.target.checked)}
            className="h-4 w-4 accent-brand-green"
          />
          {isEdit
            ? 'Email them the updated order'
            : 'Email them an order confirmation'}
        </label>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-destructive">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-sm font-semibold text-brand-green">{saved}</p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold tabular-nums text-brand-dark">
          {formatPrice(total)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-border px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-dark"
          >
            {isEdit ? 'Cancel' : 'Done'}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand-green px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-cream transition-colors hover:bg-brand-green-dark disabled:opacity-50"
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save order'}
          </button>
        </div>
      </div>
    </form>
  )
}

/* ------------------------------ Shared -------------------------------- */

const inputClass =
  'w-full rounded-md border border-input bg-background px-4 py-3 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30'

function SectionTitle({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-bold text-brand-dark">
        {title}
      </h2>
      {action}
    </div>
  )
}

function Labeled({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-dark/60">
        {label}
      </span>
      {children}
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-dark/60">
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-brand-dark">
        {value}
      </div>
    </div>
  )
}
