import { renderThankYou, thankYouMetadata } from '@/lib/routes'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ref?: string | string[] }>
}

export const metadata = thankYouMetadata('fr')

export default async function Page(props: Props) {
  const { slug } = await props.params
  const { ref } = await props.searchParams
  return renderThankYou('fr', slug, ref)
}
