import Link from "next/link";
import { getRepo } from "@/lib/session";
import { computeDue } from "@/lib/cadence";
import { Avatar, ContactLink, PageHeader, StatusPills, TypeDot, relDays } from "@/components/ui";
import { StrengthBadge } from "@/components/Strength";
import Pager, { paginate } from "@/components/Pager";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

const fmt = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) : "");

export default async function TablePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [all, settings] = await Promise.all([repo.listContactsBare(), repo.getSettings()]);
  const pg = paginate(all.filter((c) => !!c.triaged_at), sp.page, PAGE_SIZE);
  const contacts = await repo.withPhotos(pg.slice);
  const now = new Date();
  return (
    <>
      <PageHeader title="Table" sub="Spreadsheet view of every field" action={<a href="/api/export" className="btn-ghost">Export CSV</a>} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {["", "Name", "Company", "Location", "Date met", "Last contact", "Next due", "Type", "Strength", "Status", "Notes"].map((h) => (
                <th key={h} className="px-3 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const d = computeDue(c, now, settings.cadence);
              return (
                <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-paper">
                  <td className="px-3 py-2"><Avatar c={c} size={32} /></td>
                  <td className="px-3 py-2 font-medium"><ContactLink c={c} className="hover:underline">{c.name}</ContactLink></td>
                  <td className="px-3 py-2 text-muted">{c.company}</td>
                  <td className="px-3 py-2 text-muted">{c.location}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{fmt(c.date_met)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.last_contact_at)}</td>
                  <td className={`px-3 py-2 tabular-nums ${d.daysOverdue != null && d.daysOverdue >= 0 ? "font-medium text-red-600 dark:text-red-400" : ""}`}>
                    {d.nextDue ? <span title={relDays(d.daysOverdue)}>{fmt(d.nextDue)}</span> : <span className="text-muted">None</span>}
                  </td>
                  <td className="px-3 py-2"><TypeDot type={c.type} /></td>
                  <td className="px-3 py-2"><StrengthBadge value={c.strength} /></td>
                  <td className="px-3 py-2"><StatusPills statuses={c.statuses} /></td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-muted" title={c.notes ?? ""}>{c.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={pg.page} pages={pg.pages} start={pg.start} shown={contacts.length} total={pg.total} href={(n) => (n > 1 ? `/table?page=${n}` : "/table")} />
      <p className="mt-3 text-xs text-muted">Tap a name to edit. <Link href="/import" className="underline">Import from your spreadsheet</Link></p>
    </>
  );
}
