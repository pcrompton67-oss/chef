import { HomePage } from '@/components/home-page'

// Always reflect the owner's current on/off switch.
export const dynamic = 'force-dynamic'

export default function Page() {
  return <HomePage locale="en" />
}
