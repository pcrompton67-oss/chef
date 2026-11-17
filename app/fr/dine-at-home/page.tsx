import { dineAtHomeMetadata, renderDineAtHome } from '@/lib/routes'

export const metadata = dineAtHomeMetadata('fr')

export default function Page() {
  return renderDineAtHome('fr', '/dine-at-home')
}
