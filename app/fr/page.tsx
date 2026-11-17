import type { Metadata } from 'next'
import { HomePage } from '@/components/home-page'
import { content } from '@/lib/content'

const site = content.fr.site

export const metadata: Metadata = {
  title: { absolute: site.title },
  description: site.description,
  alternates: { languages: { en: '/', fr: '/fr' } },
}

export default function Page() {
  return <HomePage locale="fr" />
}
