import Link from "next/link";
import { getRepo } from "@/lib/session";
import { computeDue } from "@/lib/cadence";
import { Avatar, ContactLink, PageHeader, StatusPills, TypeDot, relDays } from "@/components/ui";
import { StrengthBadge } from "@/components/Strength";
import Pager, { paginate } from "@/components/Pager";
import { TYPES, type Contact } from "@/lib/types";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

const fmt = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) : "");

type Col = { key: string; label: string; first: "asc" | "desc"; val?: (c: Contact, due: number | null, next: string | null) => string | number | null };
const COLS: Col[] = [
  { key: "", label: "", first: "asc" },
  { key: "name", label: "Name", first: "asc", val: (c) => c.name.toLowerCase() },
  { key: "company", label: "Company", first: "asc", val: (c) => c.company?.toLowerCase() || null },
  { key: "location", label: "Location", first: "asc", val: (c) => c.location?.toLowerCase() || null },
  { key: "met", label: "Date met", first: "desc", val: (c) => c.date_met },
  { key: "last", label: "Last contact", first: "desc", val: (c) => c.last_contact_at },
  { key: "next", label: "Next due", first: "asc", val: (_c, _d, next) => next },
  { key: "type", label: "Type", first: "asc", val: (c) => (c.type ? TYPES.indexOf(c.type) : null) },
  { key: "strength", label: "Strength", first: "desc", val: (c) => c.strength },
  { key: "status", label: "Status", first: "asc", val: (c) => c.statuses.slice().sort().join(",") || null },
  { key: "notes", label: "Notes", first: "asc", val: (c) => c.notes?.toLowerCase() || null },
];

export default async function TablePage({ searchParams }: { searchParams: Promise<{ page?: string; sort?: string; dir?: string }> }) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [all, settings] = await Promise.all([repo.listContactsBare(), repo.getSettings()]);
  const now = new Date();
  const col = COLS.find((c) => c.key && c.key === sp.sort) ?? COLS[1];
  const dir = sp.dir === "desc" || sp.dir === "asc" ? sp.dir : col.first;
  // Sort the whole list (not just this page); blanks always sink to the bottom.
  const rows = all.filter((c) => !!c.triaged_at).map((c) => {
    const d = computeDue(c, now, settings.cadence);
    return { c, v: col.val!(c, d.daysOverdue, d.nextDue) };
  });
  rows.sort((a, b) => {
    if (a.v == null || a.v === "") return b.v == null || b.v === "" ? 0 : 1;
    if (b.v == null || b.v === "") return -1;
    const r = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v));
    return (dir === "asc" ? r : -r) || a.c.name.localeCompare(b.c.name);
  });
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ sort: col.key === "name" && dir === "asc" ? undefined : col.key, dir: dir === col.first ? undefined : dir, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return p ? `/table?${p}` : "/table";
  };
  const pg = paginate(rows.map((r) => r.c), sp.page, PAGE_SIZE);
  const contacts = await repo.withPhotos(pg.slice);
  return (
    <>
      <PageHeader title="Table" sub="Spreadsheet view of every field" action={<a href="/api/export" className="btn-ghost">Export CSV</a>} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {COLS.map((h) => {
                if (!h.key) return <th key="photo" className="w-12 px-3 py-2.5" />;
                const on = h.key === col.key;
                const next = on ? (dir === "asc" ? "desc" : "asc") : h.first;
                return (
                  <th key={h.key} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"} className="px-1 py-1.5 font-medium">
                    <Link href={qs({ sort: h.key, dir: next === h.first ? undefined : next, page: undefined })} scroll={false}
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 transition-colors hover:bg-paper hover:text-ink ${on ? "text-ink" : ""}`}>
                      {h.label}
                      <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 transition-transform ${on ? "opacity-100" : "opacity-0"} ${on && dir === "desc" ? "rotate-180" : ""}`} fill="currentColor"><path d="M5 2 9 8H1z" /></svg>
                    </Link>
                  </th>
                );
              })}
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
      <Pager page={pg.page} pages={pg.pages} start={pg.start} shown={contacts.length} total={pg.total} href={(n) => qs({ page: n > 1 ? String(n) : undefined })} />
      <p className="mt-3 text-xs text-muted">Tap a name to edit. <Link href="/import" className="underline">Import from your spreadsheet</Link></p>
    </>
  );
}
