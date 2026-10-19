# Cadence

A free, multi-user networking CRM: photo-first contacts, cadence reminders by type color, Gmail and Calendar sync, daily phone push, and an MCP endpoint for local agents.

## Run locally (demo data, no accounts)

```
npm install
DEMO_MODE=1 npm run dev
```

Open http://localhost:3000. Tests: `npm test`.

## Deploy

1. **Supabase**: create a free project. In SQL Editor, run `supabase/migrations/001_init.sql`. Then add invited emails:
   `insert into allowed_emails values ('you@gmail.com'), ('friend@gmail.com');`
2. **Google Cloud**: create an OAuth client (Web application). Enable the Gmail API and Google Calendar API. On the consent screen add scopes `gmail.metadata` and `calendar.events.readonly`.
   - Authorized redirect URIs: `https://<APP_URL>/api/google/callback` and `https://<SUPABASE_REF>.supabase.co/auth/v1/callback`
3. **Supabase Auth**: Authentication > Providers > Google, paste the same client ID and secret. Set Site URL to your app URL.
4. **Keys**: `npx web-push generate-vapid-keys`, and `openssl rand -hex 32` twice (TOKEN_ENCRYPTION_KEY, CRON_SECRET).
5. **Vercel**: import the repo, set every variable in `.env.example`, deploy. The daily job in `vercel.json` runs at 15:00 UTC (8am Pacific).
6. **Phone**: open the app in Safari, Share > Add to Home Screen, open it from the Home Screen, Settings > Turn on notifications.
7. **Agents**: Settings > Create agent token, then
   `claude mcp add --transport http cadence https://<APP_URL>/api/mcp --header "Authorization: Bearer <token>"`

Optional: to honor each user's digest hour, call `/api/cron/daily` hourly with Supabase pg_cron (free) instead of the daily Vercel job.

## How "last contact" is computed

- Email counts only when both of you wrote in the same thread.
- Calendar counts for events you did not decline with 2 to 8 attendees.
- "Talked" in the app, or `log_interaction` from an agent, counts immediately.

Contacts with no dates are tagged New and never nag until a date exists.
