import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('fr', 'legalNotice')

export default function Page() {
  return renderLegal('fr', 'legalNotice')
}
