import { dineAtHomeMetadata, renderDineAtHome } from '@/lib/routes'

export const metadata = dineAtHomeMetadata('en')

export default function Page() {
  return renderDineAtHome('en', '/dine-at-home')
}
