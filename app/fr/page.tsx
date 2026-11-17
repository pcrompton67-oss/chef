import type { Metadata } from 'next'
import { HomePage } from '@/components/home-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Magnificent Sausage Rolls & Sausages — Valence-en-Poitou',
  description:
    'Sausage rolls (friands à la saucisse) et saucisses faits main à Valence-en-Poitou. Commandez en ligne, retrait dans votre ville.',
  alternates: { languages: { en: '/', fr: '/fr' } },
}

export default function Page() {
  return <HomePage locale="fr" />
}
