## How Paul works (applies on every device)

- I'm not a developer: explain in plain English, no jargon, no code unless I ask.
- Before changing anything, say in 2–3 sentences what you'll do and why, and wait for my OK. Ask before anything hard to undo.
- When done: short summary of what changed, what to check (and where), and anything I must do myself.
- GitHub Issues are the to-do list and history. Labels follow Matt Pocock's standard: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `bug`. Never create spec/TODO/notes files; offer to file new ideas as issues.
- "Work on #N": read the issue with its comments, propose a short plan, wait for OK, build, check against its "Done when".
- Finishing a ticket: commit ending `Closes #N`, push, comment a 3–5 line summary on the issue. Leftovers become new issues.
- Full rules: `CLAUDE.md` in my private repo `pcrompton67-oss/claude-settings`.

## This app is LIVE and takes real orders

Pushing to `main` publishes straight to the live site via Vercel. Real customers order here and the owner runs his deliveries from it. Work on a branch and get Paul's OK before merging to `main`; never test against live customer data.

## What it is

Ordering site and management console for **Magnificent Sausage Rolls & Sausages**, a small fortnightly delivery business in Valence-en-Poitou (86), run by Bob. Paul built it (originally in v0) and hosts it for him.

- Live: `sausage-rolls.vercel.app`, domain `magnificentsausages.com` (DNS on Cloudflare).
- Customers pick items from the current menu, choose a drop-off town, and order. No online payment: cash or cheque at the drop-off. Bob gets a new-order email alert.
- Bob uses `/manager` (PIN-protected) to run each delivery.

It started as a copy of the Treat Stop bakery pre-order app (also Paul's), and features are sometimes ported between the two.

## How a delivery works (the domain)

- **Menu** = one fortnight's delivery run. Only one is active. It has a Friday start (`sale_date`), Saturday end (`sale_date_end`), an order cutoff (`cutoff_at`) and an owner on/off switch (`orders_open`). Ordering is open only when the switch is on AND the cutoff hasn't passed.
- **Drop-off towns** (`villages`): a fixed list, each with a drop-off time and a delivery day (Thursday–Sunday; Fri/Sat normal, Thu/Sun extra). Dates are worked out from the run's Fri/Sat.
- **Products** (`products`) are the reusable catalogue; **menu items** (`menu_items`) are the products on this run's menu, with price, seasonal and sold-out flags.
- **Orders** belong to a menu and a town. `source` records whether it came from the website or Bob took it by email/Messenger/phone/in person. Order lines can be ticked "allocated" once set aside.
- **Sausage meat** is a special item: the customer also picks which sausage flavour it's made from (`flavour_item_id`).
- **Customers** list with consent for reminder emails; unsubscribe page; data-use policy page (business details in `features/customers/config.ts`).
- **Pickup reminders**: a Vercel cron (`vercel.json`, runs 16:00 and 17:00 UTC) emails customers at 18:00 Paris time the evening before their delivery. Switchable in the console; sends are logged so nobody gets two.
- Also: **Next deliveries** list for the homepage, a homepage **banner**, and a photo **gallery** (images in Vercel Blob).

Manager console tabs: Delivery (Overview, Menu, Drop-offs, Orders), Next deliveries, Banner, Products, Drop-offs (master list), Customers, Gallery.

## Tech

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui. Package manager: **pnpm**.
- Next 16 differs from older versions: check `node_modules/next/dist/docs/` before writing Next-specific code.
- Database: Neon Postgres, raw SQL via `@neondatabase/serverless` (`lib/db.ts`). **No ORM and no schema or migration files**: the tables were created directly in Neon by v0. Inspect the live schema before assuming columns, and treat any table change as hard to undo (ask first).
- Tables: `menus`, `menu_items`, `products`, `villages`, `orders`, `order_items`, `customers`, `upcoming_deliveries`, `site_banner`, `gallery_photos`, `app_settings`, `pickup_reminder_sends`.
- Email: Resend (`lib/email.ts`), sender `orders@magnificentsausages.com`. Without `RESEND_API_KEY` emails silently don't send. Don't add a separate Reply-To (it sent Treat Stop emails to spam).
- Manager auth: a single PIN (`MANAGER_PIN`), sent as the `x-pin` header and checked in `lib/pins.ts`.
- Dates and "tomorrow" are always Europe/Paris time.
- No automated tests.

## Where things are

- `app/page.tsx` homepage, `app/order/` ordering, `app/manager/manager-console.tsx` the console (large file, ~2,500 lines), `app/api/` API routes.
- `features/` self-contained features (customers, pickup reminders, banner, gallery, next deliveries) designed to be portable to the Treat Stop app.
- `lib/types.ts` domain types and date/price helpers.
- `v0_memories/` is v0's leftover reference copies of features. Not used by the app; ignore it.

## Environment variables (set in Vercel)

`DATABASE_URL`, `MANAGER_PIN`, `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (optional), `OWNER_NOTIFY_EMAIL`, `CRON_SECRET`, plus the Vercel Blob token for the gallery. To run locally, pull them with `vercel env pull`; never commit them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
