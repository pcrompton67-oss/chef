'use client'

import Link from 'next/link'
import { customersConfig } from './config'

// Opt-in for order-reminder emails, shown on the order form. Unticked by
// default: consent must be an affirmative action.
export function ConsentCheckbox({
  checked,
  onChange,
  disabled,
  locale = 'en',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  locale?: 'en' | 'fr'
}) {
  const policyLink = (
    <Link
      href={customersConfig.policyPath}
      target="_blank"
      className="font-semibold text-brand-green underline underline-offset-2"
    >
      {locale === 'fr' ? 'politique d’utilisation des données' : 'data-use policy'}
    </Link>
  )
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-brand-dark">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
      />
      {locale === 'fr' ? (
        <span>
          Prévenez-moi par e-mail quand les commandes ouvrent pour la prochaine
          livraison. Nous utilisons votre nom et votre e-mail uniquement pour
          cela, et vous pouvez vous désinscrire depuis chaque e-mail. Voir notre{' '}
          {policyLink} (en anglais).
        </span>
      ) : (
        <span>
          Email me when orders open for the next delivery. We only use your name
          and email for this, and you can unsubscribe from any email. See our{' '}
          {policyLink}.
        </span>
      )}
    </label>
  )
}
