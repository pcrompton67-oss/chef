import { OrderClient } from '@/app/order/order-client'

export const metadata = {
  title: 'Commander — Magnificent Sausage Rolls & Sausages',
}

export default function OrderPageFr() {
  return <OrderClient locale="fr" />
}
