import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('en', 'allergens')

export default function Page() {
  return renderLegal('en', 'allergens')
}
