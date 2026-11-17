import { renderThankYou, thankYouMetadata, type ThankYouQuery } from '@/lib/routes'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<ThankYouQuery>
}

export async function generateMetadata(props: Props) {
  return thankYouMetadata('en', await props.searchParams)
}

export default async function Page(props: Props) {
  const { slug } = await props.params
  return renderThankYou('en', slug, await props.searchParams)
}
