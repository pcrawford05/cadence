# Cadence: context for agents working on this repo

Cadence is Peyton Crawford's personal networking CRM (coffee chats, recruiters, founders). It replaced a spreadsheet.
It is shared with one friend; each person has a separate, fully private login. Visual, photo-forward, mobile-first PWA.

Live: https://cadence-sigma-lime.vercel.app  ·  Repo: github.com/pcrawford05/cadence (branch `main` deploys)

## House rules (from Peyton)

- Never use em dashes anywhere: UI copy, comments, commit messages, docs.
- Ask clarifying questions before substantial work; small, clear fixes can just ship.
- Test on mobile (393px iPhone) and desktop, light and dark, with Reduce Motion on and off. Peyton uses Reduce Motion and cross-fade transitions on his iPhone.
- Never type secrets into fields or files. Peyton pastes keys himself (Vercel env vars, Supabase).

## Stack

- Next.js 15 App Router, React 19, Tailwind 3, TypeScript. Server actions in `app/actions.ts`.
- Supabase: Postgres with row-level security on every table, Google auth, private Storage bucket `photos`.
- Vercel Hobby, region iad1 (pinned in `vercel.json`), one daily cron at 15:00 UTC (`/api/cron/daily`).
- Web Push with VAPID (`lib/push.ts`, `public/sw.js`). The service worker also sets the home-screen badge.
- Gemini (free tier) for the Recap feature (`lib/ai.ts`).

## Accounts (who owns what)

| Service | Account |
|---|---|
| GitHub (`pcrawford05/cadence`), Supabase | pcrawford05 |
| Vercel, Google Cloud (OAuth client), Google AI Studio (Gemini key) | peytoncrawford05@gmail.com |
| Gmail + Calendar the app reads | pcrawfor@usc.edu (OAuth app is in Testing mode; that address is the test user) |
| Feedback emails go to | pcrawfor@usc.edu (via Resend) |

Supabase project ref: `gwmujjkkstsrvaildfqw`.

## Deploying (important)

- Push to `main`; Vercel builds automatically.
- Commits MUST be authored as `pcrawford05 <179640946+pcrawford05@users.noreply.github.com>` or Vercel Hobby blocks the deploy:
  `git -c user.name=pcrawford05 -c user.email="179640946+pcrawford05@users.noreply.github.com" commit -m "..."`
- Database changes: add `supabase/migrations/00N_name.sql`, then run it in the Supabase SQL editor (no CLI linked). Migrations 001 to 005 are applied.

## Env vars (set in Vercel; values never in the repo)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`TOKEN_ENCRYPTION_KEY` (AES-GCM for Google refresh tokens), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`CRON_SECRET`, `APP_URL`, `RESEND_API_KEY`, `FEEDBACK_FROM`, `FEEDBACK_TO`, `GEMINI_API_KEY`, optional `GEMINI_MODEL` (leave unset; the app auto-picks the newest Flash model).

## Run locally

- `DEMO_MODE=1 npm run dev` runs with in-memory fictional data (`DemoRepo`, `DemoRecap` in `lib/repo.ts` / `lib/recap.ts`). No env vars needed.
- `npm test` (vitest, 25 tests), `npm run typecheck`.
- For realistic timing, test the production build: `DEMO_MODE=1 npx next build && DEMO_MODE=1 npx next start -p 3200`.
  Do not run `next dev` and `next build` at the same time; they share `.next` and corrupt each other.
- Browser checks: Playwright (Python) at 393x852 with an iPhone user agent, touch on. Set `sessionStorage['cadence.launched']='1'` to skip the launch screen.

## Code map

- `lib/types.ts`: Contact model. Types are colors with cadences (red 14d, orange 30, yellow 90, green 180, blue 365, purple "When relevant", the default). Strength 1 to 7. Statuses: active, dormant, nurture, priority, new.
- `lib/cadence.ts`: due-date engine (`computeDue`, `dueList`, `inboxBatch`, `digestText`). Next due = last contact (or date met) + cadence; per-person `cadence_days_override` replaces the type's days; Priority pulls the date in to `priority_due` (default 14 days after creation).
- `lib/repo.ts`: `Repo` interface with `SupabaseRepo` and `DemoRepo`. Photos are stored as `storage:<path>` and batch-signed with a 10-hour reuse cache so browsers cache images. Use `listContactsBare()` plus `withPhotos(subset)`; avoid `listContacts()` on pages (it signs everyone).
- `lib/session.ts`: cached auth (`getClaims`), `getRepo`, `getRecap`, `getRepoOrNull` (API routes).
- `lib/google.ts`: Gmail (metadata scope, headers only, cannot search; walks the SENT label) and Calendar sync into `signals`.
- `lib/ai.ts` + `lib/recap.ts`: Recap. Signals become proposals via Gemini (Flash-Lite first for typed entries, fallback chain on 429/503, rule-based fallback if Gemini is down). Proposals are approved or dismissed in `/recap`; new people are created as contacts.
- `lib/badge.ts` + `lib/badgeStore.ts`: red badge counts (inbox left today + recap pending + unchecked reminders). Shown on tabs, set on the app icon, and sent with every push.
- `lib/scanStore.ts`: once-per-day background recap scan started by the app shell.
- `lib/mcp-tools.ts` + `app/api/mcp`: MCP server for agents (bearer token per user; only the SHA-256 hash is stored). Tools: list_due, search_contacts, get_contact, log_interaction, update_contact, snooze, list_inbox, add_contact.
- `app/api/cron/daily`: Google sync, daily recap drafting, morning digest push, reminders push, every-3-days recap push.
- Pages: `/` Due, `/inbox` (daily triage of LinkedIn imports + "Today" reminders), `/recap`, `/people` (shuffled, 12 per page on phones, 30 on desktop), `/table` (20 per page, sortable columns), `/contacts/[id]` (inline autosave editing), `/settings`, `/import`.
- Components of note: `Nav.tsx` (glass header, floating pill tab bar with a finger-following lens), `Splash.tsx` (cold-open launch screen that preloads photos and tabs), `InboxCard.tsx`, `RecapClient.tsx`, `PhotoDrop.tsx` (paste/drop/pick photos, resized to 512px client-side).

## Design system

- Warm paper and green palette (`app/globals.css` CSS variables), serif display headings, system sans body.
- Liquid glass on chrome only (nav, tab bar, sheets, popups): `.glass`, `.glass-thin`. Content cards stay solid. Always include `-webkit-backdrop-filter`; fallbacks exist for reduced transparency and high contrast.
- Motion: spring `linear()` easing in `--spring`. Every animation has a Reduce Motion version that cross-fades instead of moving (see the `prefers-reduced-motion` block). Keep that parity for anything new.
- Inputs are 16px on phones (prevents iOS zoom). Buttons do not wrap.

## Known open items

- Priority deadline never clears after you talk to the person (they stay overdue until Priority is removed). Proposed fix: treat it as met when a conversation is logged after it was set.
- Old GCP OAuth client secret ending in "kizK" can be deleted.
- Home-screen badge only updates on a push or when the app is open (iOS limitation for web apps).
