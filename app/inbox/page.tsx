import Link from "next/link";
import { getRepo } from "@/lib/session";
import { inboxBatch } from "@/lib/cadence";
import { PageHeader } from "@/components/ui";
import InboxCard from "@/components/InboxCard";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null);

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ more?: string }> }) {
  const { more } = await searchParams;
  const repo = await getRepo();
  const [contacts, settings] = await Promise.all([repo.listContactsBare(), repo.getSettings()]);
  const extra = Math.max(0, Number(more ?? 0));
  const info0 = inboxBatch(contacts, new Date(), settings.inbox_daily, settings.timezone, extra);
  const info = { ...info0, batch: await repo.withPhotos(info0.batch) };

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

      <div>
        {info.batch.map((c) => <InboxCard key={c.id} c={c} connected={fmt(c.linkedin_connected_on)} />)}
      </div>
    </>
  );
}
