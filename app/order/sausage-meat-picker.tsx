'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { flavourLabel, formatPrice, type MenuItem } from '@/lib/types'

// Sausage meat is ordered per flavour: one stepper for each sausage on this
// delivery's menu. Sold-out sausages can't be chosen as meat either.
export function SausageMeatPicker({
  item,
  flavours,
  qty,
  onChange,
  disabled,
  locale = 'en',
}: {
  item: MenuItem
  flavours: MenuItem[]
  qty: Record<number, number>
  onChange: (flavourId: number, next: number) => void
  disabled: boolean
  locale?: 'en' | 'fr'
}) {
  const fr = locale === 'fr'
  const t = {
    soldOut: fr ? 'Épuisé' : 'Sold out',
    chosen: (n: number) => (fr ? `${n} choisi${n > 1 ? 's' : ''}` : `${n} chosen`),
    choose: fr ? 'Choisir les parfums' : 'Choose flavours',
    help: fr
      ? 'Choisissez le parfum de saucisse pour chaque paquet de chair. Mélangez autant que vous voulez.'
      : 'Pick the sausage flavour for each pack of meat. Mix and match as many as you like.',
    remove: (n: string) => (fr ? `Retirer une chair ${n}` : `Remove one ${n} sausage meat`),
    add: (n: string) => (fr ? `Ajouter une chair ${n}` : `Add one ${n} sausage meat`),
  }
  const total = Object.values(qty).reduce((a, b) => a + b, 0)
  const [open, setOpen] = useState(total > 0)
  const chosen = flavours.filter((f) => (qty[f.id] ?? 0) > 0)
  const available = flavours.filter((f) => !f.is_sold_out)
  const soldOut = item.is_sold_out || available.length === 0

  return (
    <div
      className={`rounded-md border bg-card transition-colors ${
        total > 0 ? 'border-brand-green' : 'border-border'
      } ${soldOut && total === 0 ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 p-2 pl-4">
        <div className="flex flex-1 flex-col gap-0.5 py-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-brand-dark">{item.name}</span>
            <span className="text-sm tabular-nums text-brand-dark/60">
              {formatPrice(item.price_cents)}
            </span>
          </div>
          {item.description ? (
            <p className="text-xs leading-relaxed text-brand-dark/60">{item.description}</p>
          ) : null}
          {total > 0 && !open ? (
            <p className="text-xs leading-relaxed text-brand-green">
              {chosen.map((f) => `${qty[f.id]} × ${flavourLabel(f.name)}`).join(', ')}
            </p>
          ) : null}
        </div>
        {soldOut && total === 0 ? (
          <span className="rounded-md bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-dark/70">
            {t.soldOut}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2.5 text-sm font-bold text-brand-cream disabled:opacity-40"
          >
            {total > 0 ? t.chosen(total) : t.choose}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {open && !(soldOut && total === 0) ? (
        <div className="border-t border-border px-4 pb-3 pt-2">
          <p className="mb-2 text-xs leading-relaxed text-brand-dark/60">
            {t.help}
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {flavours.map((f) => {
              const q = qty[f.id] ?? 0
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span
                    className={`text-sm ${
                      q > 0 ? 'font-semibold text-brand-green' : 'text-brand-dark'
                    } ${f.is_sold_out && q === 0 ? 'text-brand-dark/50' : ''}`}
                  >
                    {flavourLabel(f.name)}
                  </span>
                  {f.is_sold_out && q === 0 ? (
                    <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">
                      {t.soldOut}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={t.remove(flavourLabel(f.name))}
                        onClick={() => onChange(f.id, q - 1)}
                        disabled={disabled || q === 0}
                        className="h-8 w-8 rounded-md bg-muted text-lg font-bold text-brand-dark disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-bold tabular-nums text-brand-green">
                        {q}
                      </span>
                      <button
                        type="button"
                        aria-label={t.add(flavourLabel(f.name))}
                        onClick={() => onChange(f.id, q + 1)}
                        disabled={disabled || item.is_sold_out || f.is_sold_out}
                        className="h-8 w-8 rounded-md bg-brand-green text-lg font-bold text-brand-cream disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
