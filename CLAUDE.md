## How Paul works (applies on every device)

- I'm not a developer: explain in plain English, no jargon, no code unless I ask.
- Before changing anything, say in 2–3 sentences what you'll do and why, and wait for my OK. Ask before anything hard to undo.
- When done: short summary of what changed, what to check (and where), and anything I must do myself.
- GitHub Issues are the to-do list and history. Labels follow Matt Pocock's standard: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `bug`. Never create spec/TODO/notes files; offer to file new ideas as issues.
- "Work on #N": read the issue with its comments, propose a short plan, wait for OK, build, check against its "Done when".
- Finishing a ticket: commit ending `Closes #N`, push, comment a 3–5 line summary on the issue. Leftovers become new issues.
- Full rules: `CLAUDE.md` in my private repo `pcrompton67-oss/claude-settings`.

## Status: connected to Vercel

The site is deployed on Vercel from `main`: **merging to `main` publishes it straight away**. Always work on a branch and get Paul's OK before merging. It is not launched to the public yet (see the go-live checklist, issue #15).

## What it is

Website and management console for **Eleanor Jessica, cheffe privée** (a private chef). Paul builds and hosts it. It was started from a copy of Paul's sausage-rolls ordering app; all the sausage-specific code has been removed (issue #1). Customer-facing features (menus, bookings, etc.) are added through GitHub issues.

- On the site her name is always "Eleanor Jessica" with the strapline "cheffe privée". Never "Chef Eleanor".
- Address for now: `chefej.popol.tech` (set as `SITE_URL` in `app/layout.tsx`; change it there if the domain changes).
- Eleanor uses `/manager` (PIN-protected) to run things.

## How Dine at Home works

Working assumptions (issue #2). Paul and Eleanor should correct anything that's wrong.

- An **event** is one Dine at Home evening: a themed four-course menu Eleanor prepares, which customers collect and finish at home (with her video guide). It has a date (usually a Friday), price and deposit per person, a capacity in diners, an order cut-off, and a status: draft → open → sold out / closed → done.
- The **menu** is a list of **courses**. A fixed course is the same for everyone. A choice course (e.g. the main) has two or more **options**, and each diner picks one. Each course has a short italic description line, with components separated by " · ".
- **Collection points**: each event has a few places, each with a collection time and an exact address (e.g. Lorigné 17:00, Sauzé-Vaussais 17:30, St-Pierre-d'Exideuil 18:00, Ruffec 18:30).
- An **order** is for a number of diners at one collection point. It records how many chose each option of every choice course, plus allergies, language, and where it came from (website, phone, WhatsApp, …).
- **Payment**: a deposit per person is paid when ordering (card or bank transfer; cash or cheque for orders Eleanor takes herself). The balance is paid at collection. Unpaid orders hold their places until `hold_expires_at`, then expire. Refunds are tracked on the order.
- **Customers** are remembered by email, with marketing consent. People can sign up to be notified when the next event opens.

## Look and feel

Fine dining, calm and elegant. Taken from Eleanor's own files in `public/`:

- `CEJ_Logo.jpg`: round logo (header, PIN screen, favicon, social image). `CEJ_Banner.jpg`, `CEF_Food1.jpg`, `CEJ_Food2.jpg`: photos. `CEJ_Menu_Indian.jpg`: her printed menu, the model for menu typography.
- Colours (set in `app/globals.css`): cream background, charcoal text, her logo's warm gold (`#D4AC54`) as the single accent, plus the logo's soft grey (`#5A5A5A`). A deeper gold is used when gold is text, so it stays readable.
- Fonts (set in `app/layout.tsx`): Cormorant Garamond (serif) for headings, Jost (light sans-serif) for body text.
- Spaced capitals for titles, thin rules between courses, middle dots (·) between dish components, centred small-caps course names.
- No bright colours, gradients, emoji or rounded "app" buttons (corners are square site-wide; the one exception is the menu card on an evening's page, which has softly rounded corners on a band of her gold, like her paper menus). Content fades in slowly on scroll.

## Where things are

- `lib/content.ts`: **all customer-facing wording**, with an English and a French slot. Change wording there, not in components.
- `lib/i18n.ts`: language helpers. English lives at `/`, French at `/fr`.
- `components/site/`: shared layout pieces: header, footer, section, button styles, fade-in, tasting menu, availability note.
- Public pages (no home page for now; `/` shows Dine at Home):
  - `components/dine-at-home-page.tsx`: the Dine at Home page (`/`, `/dine-at-home`, and `/fr/…`).
  - `components/event-page.tsx`: one evening (`/dine-at-home/[slug]`): menu, price, collection times, then the order form (or, when sold out, a "tell me about the next one" box). "Only X places left" shows at 8 or fewer (`LOW_PLACES` in `lib/events.ts`).
  - `lib/events.ts`: reads published events from the database. It never selects collection addresses, so they can't appear publicly.
  - `components/order-form.tsx`: the order form (live check that dishes chosen = diners). `components/thank-you-page.tsx`: shown after ordering (`/dine-at-home/[slug]/thank-you`).
  - `lib/orders.ts` (`/api/orders`, `/api/notify`): checks and saves orders. It re-checks everything, locks the event while counting places so two people can't take the last ones, and saves the customer and their consent. Website orders are "held" awaiting a bank transfer, with no time limit for now (max 12 diners per order).
  - `lib/routes.tsx`: shared code behind the English and French page files in `app/`.
- `components/pin-gate.tsx`, `app/manager/`: the PIN screen and the console shell (add new console sections to its `TABS` list). Console header and tabs are hidden when printing (`print:hidden`).
- Console → Events (issue #7): `components/manager/events-tab.tsx` (list and editor), `lib/manager-events.ts` (reads/saves events with menu and collection points in one all-or-nothing save; includes drafts and addresses, so PIN-only), `lib/event-editing.ts` (shapes shared with the browser, and the list of photos to choose from), API at `app/api/manager/events`. New and duplicated evenings start as drafts. Dishes and collection points already ordered can't be removed; capacity can't go below places taken. Test or real is fixed at creation; only test evenings (with their orders) can be deleted.
- `app/api/verify-pin`: checks the PIN.
- `v0_memories/`: v0's leftover reference copies from the old app. Not used; ignore.

## Tech

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui. Package manager: **pnpm**.
- Next 16 differs from older versions: check `node_modules/next/dist/docs/` before writing Next-specific code.
- `pnpm build` skips type checks (`next.config.mjs`), so also run `npx tsc --noEmit`.
- Database: Neon Postgres, raw SQL via `query()` in `lib/db.ts` (`@neondatabase/serverless`; falls back to plain `pg` when `DATABASE_URL` is a localhost address, for local previews), no ORM. The tables are defined by the numbered files in `migrations/` (see "Database" below). Treat any table change as hard to undo (ask first).
- Manager auth: a single PIN (`MANAGER_PIN`), sent as the `x-pin` header and checked in `lib/pins.ts`.
- Dates are always Europe/Paris time.
- No automated tests.

## Database

- Tables are created by the numbered SQL files in `migrations/`. To change the database, **add a new numbered file**; never edit one that has already been run. Each file runs once, in number order. The database remembers which have run (table `schema_migrations`), and the files are also safe to run twice.
- Money is always stored in euro cents (`…_cents`).
- Test data is flagged `is_test` and uses `@example.com` emails, so nothing reaches real people.
- Commands (they use `DATABASE_URL`, read from `.env.local`; get it with `vercel env pull .env.local`):
  - `pnpm db:migrate`: apply any new migration files.
  - `pnpm db:seed`: add (or refresh) the test event "TEST – Inspired by India" with its menu, collection points and orders.
  - `pnpm db:unseed`: remove all test data (real data is never touched).

## Environment variables (set in Vercel)

`MANAGER_PIN` (needed now), `DATABASE_URL` (for features that use the database). Pull them with `vercel env pull`; never commit them.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
