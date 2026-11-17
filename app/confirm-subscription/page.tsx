import { confirmSignupMetadata, renderConfirmSignup } from '@/lib/routes'

type Props = { searchParams: Promise<{ t?: string | string[] }> }

export const metadata = confirmSignupMetadata('en')

export default async function Page(props: Props) {
  const { t } = await props.searchParams
  return renderConfirmSignup('en', t)
}
