import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('fr', 'allergens')

export default function Page() {
  return renderLegal('fr', 'allergens')
}
