import { renderUnsubscribe, unsubscribeMetadata } from '@/lib/routes'

type Props = { searchParams: Promise<{ t?: string | string[] }> }

export const metadata = unsubscribeMetadata('fr')

export default async function Page(props: Props) {
  const { t } = await props.searchParams
  return renderUnsubscribe('fr', t)
}
