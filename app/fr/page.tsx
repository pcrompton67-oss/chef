import { dineAtHomeMetadata, renderDineAtHome } from '@/lib/routes'

// For now the site opens straight onto Dine at Home.
export const metadata = dineAtHomeMetadata('fr')

export default function Page() {
  return renderDineAtHome('fr', '/')
}
