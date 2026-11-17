import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('fr', 'terms')

export default function Page() {
  return renderLegal('fr', 'terms')
}
