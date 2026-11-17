import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('en', 'terms')

export default function Page() {
  return renderLegal('en', 'terms')
}
