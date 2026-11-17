import { legalMetadata, renderLegal } from '@/lib/routes'

export const metadata = legalMetadata('en', 'privacy')

export default function Page() {
  return renderLegal('en', 'privacy')
}
