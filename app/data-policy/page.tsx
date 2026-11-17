import type { Metadata } from 'next'
import Link from 'next/link'
import { customersConfig as cfg } from '@/features/customers/config'

export const metadata: Metadata = {
  title: `Data-use policy — ${cfg.businessName}`,
  description: 'How we use your name and email address when you order.',
}

export default function DataPolicyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-brand-green px-5 py-6 text-brand-cream">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold text-brand-yellow underline-offset-2 hover:underline"
          >
            ‹ Home
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-yellow">
            Data-use policy
          </h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-10 leading-relaxed text-brand-dark">
        <p className="text-pretty text-brand-dark/80">
          This page explains what personal information {cfg.businessName}{' '}
          collects when you place an order or sign up for reminders, why we
          collect it, and what you can
          do about it. We keep it deliberately short: we only ask for what we
          need to get your {cfg.productNoun} to you.
        </p>

        <Section title="Who we are">
          <p>
            {cfg.legalName}. You can contact us about your data at{' '}
            <a
              href={`mailto:${cfg.contactEmail}`}
              className="font-semibold text-brand-green underline underline-offset-2"
            >
              {cfg.contactEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Your name and email address</strong>, entered when you
              order or sign up for reminders on our home page (the name is
              optional there).
            </li>
            <li>
              <strong>Your order</strong>: the items, quantities, drop-off town
              and any notes you add.
            </li>
            <li>
              Whether you asked to receive emails when orders open, and when
              you asked.
            </li>
          </ul>
          <p>
            We do not collect payment details — you pay in person on the day.
          </p>
        </Section>

        <Section title="How we use it">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>To fulfil your order</strong>: preparing it, bringing it
              to the right town, and contacting you if there is a problem. This
              is necessary to provide what you ordered.
            </li>
            <li>
              <strong>To tell you when orders open</strong>, only if you
              ticked the box on the order form or signed up on our home page.
              When you sign up we send one email to confirm it. After that we
              only email you about ordering: when orders open for a delivery,
              and occasionally a reminder before they close. Every one of these
              emails includes an unsubscribe link.
            </li>
          </ul>
          <p>
            We never sell or share your details with anyone else for their own
            marketing.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Your details are stored in our order database and are only
            accessible to the people who run {cfg.businessName}. If you have
            opted in to emails, your name and address are also passed to our
            email delivery provider purely to send those emails.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep order details for our business records. If you have opted
            in to reminders, we keep your name and email on our customer list
            until you unsubscribe or ask us to remove you.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask us at any time to see the information we hold about
            you, to correct it, or to delete it. You can stop reminder emails
            instantly using the unsubscribe link in any email, or by emailing
            us. We will act on requests within a month.
          </p>
        </Section>

        <p className="text-sm text-brand-dark/60">
          Last updated: {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
        </p>
      </main>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold text-brand-green">
        {title}
      </h2>
      {children}
    </section>
  )
}
