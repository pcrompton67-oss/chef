import { eventMetadata, renderEvent } from '@/lib/routes'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata(props: Props) {
  const { slug } = await props.params
  return eventMetadata('fr', slug)
}

export default async function Page(props: Props) {
  const { slug } = await props.params
  return renderEvent('fr', slug)
}
