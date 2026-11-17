import type { Metadata } from 'next'
import Link from 'next/link'
import { customersConfig as cfg } from '@/features/customers/config'
import { unsubscribeByToken } from '@/features/customers/lib'

export const metadata: Metadata = {
  title: `Unsubscribe — ${cfg.businessName}`,
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const ok = token ? await unsubscribeByToken(token) : false

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-brand-green px-5 py-6 text-brand-cream">
        <div className="mx-auto max-w-xl">
          <h1 className="font-display text-2xl font-bold text-brand-yellow">
            {cfg.businessName}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-12">
        <div className="rounded-md border border-border bg-card p-8 text-center leading-relaxed text-brand-dark">
          {ok ? (
            <>
              <h2 className="font-display text-xl font-bold">
                You&apos;re unsubscribed
              </h2>
              <p className="mt-2 text-brand-dark/70">
                We won&apos;t email you when orders open any more. You can still
                order whenever you like, and ticking the box on the order form
                will sign you back up.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold">
                That link didn&apos;t work
              </h2>
              <p className="mt-2 text-brand-dark/70">
                The unsubscribe link looks incomplete or has already been used.
                If you still get emails, contact us at{' '}
                <a
                  href={`mailto:${cfg.contactEmail}`}
                  className="font-semibold text-brand-green underline underline-offset-2"
                >
                  {cfg.contactEmail}
                </a>{' '}
                and we&apos;ll remove you.
              </p>
            </>
          )}
          <Link
            href="/"
            className="mt-6 inline-block rounded-md bg-brand-green px-6 py-3 font-display text-lg font-bold text-brand-cream transition-colors hover:bg-brand-green-dark"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
