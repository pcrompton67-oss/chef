import { PinGate } from '@/components/pin-gate'
import { ManagerConsole } from './manager-console'

export const metadata = {
  title: 'Console',
  robots: { index: false, follow: false },
}

export default function ManagerPage() {
  return (
    <PinGate role="manager" title="Console">
      <ManagerConsole />
    </PinGate>
  )
}
