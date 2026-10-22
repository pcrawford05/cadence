import Link from "next/link";
import { getRepo } from "@/lib/session";
import { inboxBatch } from "@/lib/cadence";
import { PageHeader } from "@/components/ui";
import { StrengthPicker } from "@/components/Strength";
import PhotoDrop from "@/components/PhotoDrop";
import { archiveFromInbox, triage } from "@/app/actions";
import { TYPES, TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null);

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ more?: string }> }) {
  const { more } = await searchParams;
  const repo = await getRepo();
  const [contacts, settings] = await Promise.all([repo.listContacts(), repo.getSettings()]);
  const extra = Math.max(0, Number(more ?? 0));
  const info = inboxBatch(contacts, new Date(), settings.inbox_daily, settings.timezone, extra);

  if (info.remaining === 0) {
    return (
      <>
        <PageHeader title="Inbox" sub="New connections to sort" />
        <div className="rounded-3xl border border-dashed border-line p-10 text-center">
          <p className="font-display text-2xl">Inbox zero</p>
          <p className="mt-1 text-sm text-muted">Import your LinkedIn connections to fill it.</p>
          <Link href="/import" className="btn-primary mt-5">Import LinkedIn export</Link>
        </div>
      </>
    );
  }

  const quota = settings.inbox_daily;
  const pct = quota ? Math.min(100, (info.doneToday / quota) * 100) : 100;

  return (
    <>
      <PageHeader
        title={info.batch.length ? `Sort ${info.batch.length} ${info.batch.length === 1 ? "person" : "people"}` : "Done for today"}
        sub={`${info.remaining} connections waiting · ${info.doneToday} of ${quota} sorted today`}
      />
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>

      {info.batch.length === 0 && (
        <div className="rounded-3xl border border-line bg-card p-8 text-center">
          <p className="font-display text-2xl">Nice work.</p>
          <p className="mt-1 text-sm text-muted">Today&apos;s {quota} are sorted. The next batch arrives tomorrow.</p>
          <Link href="/inbox?more=5" className="btn-ghost mt-5">Keep going: 5 more</Link>
        </div>
      )}

      <div className="space-y-4">
        {info.batch.map((c) => (
          <article key={c.id} className="rounded-3xl border border-line bg-card p-5">
            <div className="flex items-start gap-4">
              <PhotoDrop id={c.id} name={c.name} photo={c.photo_url} type={c.type} size={72} />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-tight">{c.name}</h2>
                <p className="text-sm text-muted">{[c.position, c.company].filter(Boolean).join(" at ") || "No title on LinkedIn"}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  {c.linkedin_connected_on && <span>Connected {fmt(c.linkedin_connected_on)}</span>}
                  {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="underline">Open LinkedIn to copy photo</a>}
                </div>
              </div>
            </div>

            <form action={triage.bind(null, c.id)} className="mt-4 space-y-4">
              <fieldset>
                <legend className="label">How often to reach out</legend>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <label key={t} className="chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-paper">
                      <input type="radio" name="type" value={t} defaultChecked={t === "purple"} className="sr-only" />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_META[t].hex }} />
                      {TYPE_META[t].blurb}
                    </label>
                  ))}
                </div>
              </fieldset>
              <StrengthPicker />
              <div className="flex flex-wrap items-center gap-2">
                {(["nurture", "priority"] as const).map((s) => (
                  <label key={s} className="chip cursor-pointer capitalize has-[:checked]:border-ink has-[:checked]:bg-paper">
                    <input type="checkbox" name="statuses" value={s} className="sr-only" />
                    {s}
                  </label>
                ))}
                <input name="notes" placeholder="Note (how you know them)" className="input min-w-[200px] flex-1 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                <button className="btn-primary">Save</button>
                <button formAction={archiveFromInbox.bind(null, c.id)} className="btn-ghost">Not someone to track</button>
              </div>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
