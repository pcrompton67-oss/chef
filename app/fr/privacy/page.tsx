import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('fr', 'privacy')

export default function Page() {
  return renderLegal('fr', 'privacy')
}
