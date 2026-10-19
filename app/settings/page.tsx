import { getRepo, currentUser } from "@/lib/session";
import { saveInboxDaily, saveSettings } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { McpToken, PushControls, SyncNow } from "@/components/SettingsClient";
import { TYPES, TYPE_META } from "@/lib/types";
import { isDemo } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const repo = await getRepo();
  const [s, user] = await Promise.all([repo.getSettings(), currentUser()]);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" sub={user?.email} />

      <Card title="Gmail and Calendar" sub="Updates last contact automatically from two-way email threads and meetings. Reads headers only, never message bodies.">
        {google === "connected" && <p className="mb-3 rounded-xl bg-accent/10 p-2.5 text-sm text-accent">Connected. The last 60 days were imported.</p>}
        {google === "error" && <p className="mb-3 rounded-xl bg-red-500/10 p-2.5 text-sm text-red-600">Google connection failed. Try again.</p>}
        {s.google_email ? (
          <div className="space-y-3 text-sm">
            <p>Connected as <b>{s.google_email}</b>{s.google_last_sync && <span className="text-muted"> · last synced {new Date(s.google_last_sync).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>}</p>
            <div className="flex flex-wrap gap-2"><SyncNow /><a href="/api/google/connect" className="btn-ghost">Reconnect</a></div>
          </div>
        ) : (
          <a href="/api/google/connect" className="btn-primary">Connect Google</a>
        )}
      </Card>

      <Card title="LinkedIn" sub="LinkedIn has no API for personal connections, so Cadence imports its official export. Re-import anytime; existing people are matched, never duplicated.">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
          <li>Request your data on LinkedIn (choose the larger archive; it includes Connections).</li>
          <li>When LinkedIn emails you, download the archive and unzip it.</li>
          <li>Upload <b>Connections.csv</b> on the Import page.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer" className="btn-primary">Request export on LinkedIn</a>
          <a href="/import" className="btn-ghost">Upload Connections.csv</a>
        </div>
        <form action={saveInboxDaily} className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span>Sort</span>
          <input name="inbox_daily" type="number" min={0} max={50} defaultValue={s.inbox_daily} className="input w-20 text-center" />
          <span>new connections per day, with a reminder in the morning push.</span>
          <button className="btn-ghost">Save</button>
        </form>
      </Card>

      <Card title="Notifications" sub="One push each morning listing who is due. Overdue people repeat weekly, not daily.">
        <PushControls vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      </Card>

      <Card title="Cadence by type" sub="Days between conversations. Leave blank for no reminders.">
        <form action={saveSettings} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: TYPE_META[t].hex }} />
                <span className="w-14 text-sm font-medium">{TYPE_META[t].label}</span>
                <input name={`cad_${t}`} type="number" min={1} defaultValue={s.cadence[t] ?? ""} placeholder="none" className="w-full bg-transparent text-right text-sm tabular-nums outline-none" />
                <span className="text-xs text-muted">d</span>
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Digest time</span>
              <select name="digest_hour" defaultValue={s.digest_hour} className="input">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Time zone</span>
              <input name="timezone" defaultValue={s.timezone} className="input" />
            </label>
          </div>
          <button className="btn-primary">Save</button>
        </form>
      </Card>

      <Card title="Agent access (MCP)">
        <McpToken appUrl={appUrl} hasToken={s.has_mcp_token} />
      </Card>

      <Card title="Your data">
        <div className="flex flex-wrap gap-2">
          <a href="/import" className="btn-ghost">Import CSV</a>
          <a href="/api/export" className="btn-ghost">Export CSV</a>
          {!isDemo() && (
            <form action="/auth/signout" method="post"><button className="btn-ghost">Sign out</button></form>
          )}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="mb-4 mt-0.5 text-sm text-muted">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  );
}
