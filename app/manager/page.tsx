import { PinGate } from '@/components/pin-gate'
import { ManagerConsole } from './manager-console'

export const metadata = {
  title: 'Manager — Magnificent Sausage Rolls',
}

export default function ManagerPage() {
  return (
    <PinGate role="manager" title="Manager">
      <ManagerConsole />
    </PinGate>
  )
}
