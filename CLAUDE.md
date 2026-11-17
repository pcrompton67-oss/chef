## How Paul works (applies on every device)

- I'm not a developer: explain in plain English, no jargon, no code unless I ask.
- Before changing anything, say in 2–3 sentences what you'll do and why, and wait for my OK. Ask before anything hard to undo.
- When done: short summary of what changed, what to check (and where), and anything I must do myself.
- GitHub Issues are the to-do list and history. Labels follow Matt Pocock's standard: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `bug`. Never create spec/TODO/notes files; offer to file new ideas as issues.
- "Work on #N": read the issue with its comments, propose a short plan, wait for OK, build, check against its "Done when".
- Finishing a ticket: commit ending `Closes #N`, push, comment a 3–5 line summary on the issue. Leftovers become new issues.
- Full rules: `CLAUDE.md` in my private repo `pcrompton67-oss/claude-settings`.

## Status: being built, not live yet

This was copied from Paul's `sausage-rolls` app and is being rebuilt for Eleanor Jessica. It doesn't take real orders yet. Still work on a branch and get Paul's OK before merging to `main`. Once it goes live, real customers pay deposits here, so never test against live customer data or live Stripe keys.

- **Demo / test site (temporary): `chefej.popol.tech`.** Used to test and to show Eleanor. It runs **without email and without Stripe** for now.
- So the app must work fully with no `RESEND_API_KEY` and no Stripe keys: the card option is hidden, bank transfer works, and emails are simply not sent (orders still save and the console still works).
- Email and Stripe are switched on later, at go-live on `chefeleanor.com`.

## What it is

The website and booking platform for **Eleanor Jessica · cheffe privée** (chefeleanor.com), a private chef in the Deux-Sèvres / Charente area. Paul builds and hosts it for her.

- On the site the brand name is **Eleanor Jessica** (with "cheffe privée" as the strapline), never "Chef Eleanor".

- **Now: Dine at Home.** A themed four-course dinner on a set evening. Eleanor prepares it, customers collect a box from a collection point at a set time and finish it at home. This replaces her Tally form.
- **Later: the restaurant.** She is converting a barn into a high-end restaurant opening spring 2027. Table bookings will live at `/restaurant` in this same app. Don't build it yet, but keep customers, settings and the console general enough to add it without a rewrite.
- Customers are British expats and French locals. English first, with a full French version under `/fr`.
- Most customers order on their phone from a Facebook link: design mobile first.

## Look and feel (this matters most)

A fine-dining brand, like a Michelin restaurant's website or a high-end food magazine. Never a takeaway shop.

- Elegant serif display font for headings, clean sans-serif for body text, loaded with `next/font`.
- Cream / off-white background, deep charcoal text, and her logo's warm gold (about `#D4AC54`) as the one restrained accent, with the logo's soft grey (about `#5A5A5A`). No bright colours, gradients, emoji or rounded "app" buttons.
- Lots of white space, large full-width food photography, slow subtle fade-ins on scroll. Nothing bouncy.
- Menus laid out like a printed tasting menu: centred, course by course, small caps for course names.
- Copy is warm, personal and in Eleanor's voice ("I'll prepare…"), never salesy.
- Emails share the same look in simple HTML.
- Paul adds the logo, photos and menu images to `public/` himself. Current files: `CEJ_Logo.jpg` (round logo), `CEJ_Banner.jpg` (social banner, logo and food baked in, so not for the site), `CEJ_Food2.jpg` (velouté on dark slate, hero), `CEF_Food1.jpg` (pithivier), `CEJ_Menu_Indian.jpg` (the printed "Inspired by India" menu). `logo.jpg` / `logo.png` are the old sausage logo, to be removed.

## How Dine at Home works (the domain)

- **Event** = one Dine at Home evening. It has a title and theme (e.g. "Inspired by India"), a URL slug, a date, intro text, a hero image, a menu image, a price and a deposit per person, a capacity in diners, an order cut-off, and a status: draft / open / sold out / closed / done. Events can be duplicated to reuse their set-up. Test events are flagged `is_test` and can be deleted with one click.
- **Courses** belong to an event (usually four). A course is either *fixed* (everyone gets it) or a *choice* with options (e.g. Chicken Tikka Pithivier or Aubergine & Chickpea Pithivier (v)).
- **Collection points** belong to an event: place name, time, and an exact address. The address is never shown on the public site, only in the confirmation and reminder emails. Listed in time order.
- **Order form:** collection point → number of diners → for each choice course, how many of each option. The counts must add up to the number of diners, enforced live in the form ("2 of 4 mains chosen") and again on the server. Then name, mobile, email, allergies (required, "None" is fine), marketing opt-in (never pre-ticked), and a required agreement: subject to availability, confirmed only when the deposit arrives, balance paid on collection.
- **Capacity:** never sell more diners than capacity. Confirmed and held orders both count. The check must be safe against two people booking the last places at once (transaction / row lock). Show "Only X places left" when low. When full, show "Sold out" and a "Tell me about the next one" sign-up.
- **Deposit** (deposit per person × diners), the customer chooses:
  - *Card* via Stripe Checkout. The order is held for about 30 minutes, then confirmed automatically by the Stripe webhook. Refunds go through Stripe from the console.
  - *Bank transfer.* The order is "awaiting deposit" and holds its places for a set number of days (console setting, default 3). The customer is shown and emailed the IBAN, BIC, account name, exact amount and a short unique reference (e.g. `DAH-4F7K`). Eleanor ticks "deposit received" to confirm. Overdue orders are flagged, never released automatically: Eleanor releases them with one click. Refunds are marked as done by hand.
- **Balance** is paid in cash or by cheque on collection. The console records "collected & balance paid" and which method.
- **Bank details and other business settings** live in the settings table, edited in the console, never in the code.
- **Emails** (in the customer's language): request received (receipt, or bank details and reference), booking confirmed (exact address, time, balance due, their allergies), reminder the day before, and Eleanor's copy of each new order.
- **Customers:** everyone who has ordered, with their marketing consent. CSV export of opted-in customers only. This becomes the mailing list for the restaurant opening.

## Site structure

- `/` home: short intro, the next Dine at Home event, a "Restaurant – opening spring 2027" teaser with email sign-up.
- `/dine-at-home` upcoming and past events. `/dine-at-home/[slug]` the event page and order form.
- `/restaurant` reserved for later.
- Legal: mentions légales, privacy policy (RGPD, including the mailing list), allergen statement, booking terms (deposits and cancellations; the cancellation wording is placeholder until Eleanor supplies it).
- French versions of all public pages under `/fr`.
- `/manager` the PIN-protected console: Events (set-up, courses, collection points, open/close, duplicate), Orders (status, payment, mark deposit received, cancel/refund, manual orders for phone and WhatsApp), Prep list (totals per option plus all allergies), Collection run sheet and Box labels (printable), Customers, Settings.

## Tech

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui. Package manager: **pnpm**.
- Next 16 differs from older versions: check `node_modules/next/dist/docs/` before writing Next-specific code.
- Database: Neon Postgres (new, empty database), raw SQL via `@neondatabase/serverless` (`lib/db.ts`), no ORM.
- **Every table change is a numbered SQL migration file** in `migrations/`. Never create or change tables any other way (no "create table if not exists" in app code). Treat any change to a live table as hard to undo: ask first.
- **All money in cents.**
- Payments: Stripe Checkout + webhook. Off on the demo site; test keys until Eleanor's own Stripe account is connected.
- Email: Resend (`lib/email.ts`). Without `RESEND_API_KEY` emails silently don't send (as on the demo site). Don't add a separate Reply-To (it sent Treat Stop emails to spam).
- Manager auth: a single PIN (`MANAGER_PIN`), sent as the `x-pin` header and checked in `lib/pins.ts`.
- French: `lib/i18n.ts` and the `/fr` routes. Every customer-facing word, including emails, needs English and French.
- Dates, times, cut-offs and "the day before" are always Europe/Paris time.
- Reminder emails: a Vercel cron (`vercel.json`) at 16:00 and 17:00 UTC so one lands at 18:00 Paris time whatever the season. Sends are logged so nobody gets two.
- No automated tests. Test by hand with the seeded "TEST –" event.

## Where things are

- `app/` pages and `app/api/` API routes. `app/manager/` the console.
- `features/` self-contained features, kept portable between Paul's apps.
- `lib/types.ts` domain types and date/price helpers.
- `migrations/` numbered SQL migrations and the test seed.
- `v0_memories/` is v0's leftover reference copies from the old app. Not used by the app; ignore it.

## Environment variables (set in Vercel)

`DATABASE_URL`, `MANAGER_PIN`, `NEXT_PUBLIC_SITE_URL`, and later (not needed on the demo site) `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (optional), `OWNER_NOTIFY_EMAIL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. To run locally, pull them with `vercel env pull`; never commit them.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
