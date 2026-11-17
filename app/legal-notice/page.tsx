import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('en', 'legalNotice')

export default function Page() {
  return renderLegal('en', 'legalNotice')
}
