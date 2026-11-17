## How Paul works (applies on every device)

- I'm not a developer: explain in plain English, no jargon, no code unless I ask.
- Before changing anything, say in 2–3 sentences what you'll do and why, and wait for my OK. Ask before anything hard to undo.
- When done: short summary of what changed, what to check (and where), and anything I must do myself.
- GitHub Issues are the to-do list and history. Labels follow Matt Pocock's standard: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `bug`. Never create spec/TODO/notes files; offer to file new ideas as issues.
- "Work on #N": read the issue with its comments, propose a short plan, wait for OK, build, check against its "Done when".
- Finishing a ticket: commit ending `Closes #N`, push, comment a 3–5 line summary on the issue. Leftovers become new issues.
- Full rules: `CLAUDE.md` in my private repo `pcrompton67-oss/claude-settings`.

## Status: not live yet

The site is being rebuilt and is not yet public. Still work on a branch and get Paul's OK before merging to `main`; once it is connected to Vercel, merging to `main` will publish it.

## What it is

Website and management console for **Eleanor Jessica, cheffe privée** (a private chef). Paul builds and hosts it. It was started from a copy of Paul's sausage-rolls ordering app; all the sausage-specific code has been removed (issue #1). Customer-facing features (menus, bookings, etc.) are added through GitHub issues.

- On the site her name is always "Eleanor Jessica" with the strapline "cheffe privée". Never "Chef Eleanor".
- Address for now: `chefej.popol.tech` (set as `SITE_URL` in `app/layout.tsx`; change it there if the domain changes).
- Eleanor uses `/manager` (PIN-protected) to run things.

## Look and feel

Fine dining, calm and elegant. Taken from Eleanor's own files in `public/`:

- `CEJ_Logo.jpg`: round logo (header, PIN screen, favicon, social image). `CEJ_Banner.jpg`, `CEF_Food1.jpg`, `CEJ_Food2.jpg`: photos. `CEJ_Menu_Indian.jpg`: her printed menu, the model for menu typography.
- Colours (set in `app/globals.css`): cream background, charcoal text, her logo's warm gold (`#D4AC54`) as the single accent, plus the logo's soft grey (`#5A5A5A`). A deeper gold is used when gold is text, so it stays readable.
- Fonts (set in `app/layout.tsx`): Cormorant Garamond (serif) for headings, Jost (light sans-serif) for body text.
- Spaced capitals for titles, thin rules between courses, middle dots (·) between dish components, centred small-caps course names.
- No bright colours, gradients, emoji or rounded "app" buttons (corners are square site-wide). Content fades in slowly on scroll.

## Where things are

- `lib/content.ts`: **all customer-facing wording**, with an English and a French slot. Change wording there, not in components.
- `lib/i18n.ts`: language helpers. English lives at `/`, French at `/fr`.
- `components/site/`: shared layout pieces: header, footer, section, button styles, fade-in, tasting menu.
- `components/home-page.tsx`: the (placeholder) home page, used by `app/page.tsx` and `app/fr/page.tsx`.
- `components/pin-gate.tsx`, `app/manager/`: the PIN screen and the console shell (add new console sections to its `TABS` list). Console header and tabs are hidden when printing (`print:hidden`).
- `app/api/verify-pin`: checks the PIN.
- `v0_memories/`: v0's leftover reference copies from the old app. Not used; ignore.

## Tech

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui. Package manager: **pnpm**.
- Next 16 differs from older versions: check `node_modules/next/dist/docs/` before writing Next-specific code.
- `pnpm build` skips type checks (`next.config.mjs`), so also run `npx tsc --noEmit`.
- Database: Neon Postgres via `@neondatabase/serverless` (`lib/db.ts`), raw SQL, no ORM or migration files. The database still holds the old app's tables; nothing uses them now. Inspect the live schema before assuming anything, and treat any table change as hard to undo (ask first).
- Manager auth: a single PIN (`MANAGER_PIN`), sent as the `x-pin` header and checked in `lib/pins.ts`.
- Dates are always Europe/Paris time.
- No automated tests.

## Environment variables (set in Vercel)

`MANAGER_PIN` (needed now), `DATABASE_URL` (for features that use the database). Pull them with `vercel env pull`; never commit them.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
