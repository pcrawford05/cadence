import Link from "next/link";
import { getRepo } from "@/lib/session";
import { computeDue } from "@/lib/cadence";
import { PageHeader, relDays, sinceText } from "@/components/ui";
import PeopleGrid from "@/components/PeopleGrid";
import Pager, { paginate } from "@/components/Pager";
import { STATUSES, TYPES, TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; type?: string; status?: string; sort?: string; unsorted?: string; page?: string }>;

const PAGE_SIZE = 60; // divides evenly into 2, 3, and 5 columns

export default async function PeoplePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [all, settings] = await Promise.all([repo.listContactsBare(), repo.getSettings()]);
  const q = (sp.q ?? "").toLowerCase();
  const now = new Date();

  const unsortedCount = all.filter((c) => !c.triaged_at).length;
  let list = all
    .filter((c) => (sp.unsorted ? !c.triaged_at : q ? true : !!c.triaged_at)) // searching covers everyone
    .filter((c) => !sp.type || c.type === sp.type)
    .filter((c) => !sp.status || c.statuses.includes(sp.status as never))
    .filter((c) => !q || [c.name, c.company, c.position, c.location, c.notes].some((v) => v?.toLowerCase().includes(q)))
    .map((c) => ({ c, d: computeDue(c, now, settings.cadence) }));

  if (sp.sort === "due") list = list.sort((a, b) => (b.d.daysOverdue ?? -1e9) - (a.d.daysOverdue ?? -1e9));
  if (sp.sort === "strength") list = list.sort((a, b) => (b.c.strength ?? 0) - (a.c.strength ?? 0));
  if (sp.sort === "recent") list = list.sort((a, b) => (b.c.last_contact_at ?? "").localeCompare(a.c.last_contact_at ?? ""));

  const pg = paginate(list, sp.page, PAGE_SIZE);
  const signed = await repo.withPhotos(pg.slice.map((x) => x.c));
  const visible = pg.slice.map((x, i) => ({ ...x, c: signed[i] }));

  // Changing a filter or sort returns to page 1; only the pager sets `page`.
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/people?${s}` : "/people";
  };

  return (
    <>
      <PageHeader
        title="People"
        sub={`${list.length} shown${unsortedCount && !sp.unsorted ? ` · ${unsortedCount} unsorted in your inbox` : ""}`}
        action={
          <div className="flex gap-2">
            <Link href="/import" className="btn-ghost">Import</Link>
            <Link href="/contacts/new" className="btn-primary sm:hidden">+ Add</Link>
          </div>
        }
      />

      <form className="mb-4" action="/people">
        {sp.type && <input type="hidden" name="type" value={sp.type} />}
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        {sp.unsorted && <input type="hidden" name="unsorted" value={sp.unsorted} />}
        <input id="people-search" name="q" defaultValue={sp.q} placeholder="Search name, company, notes   ( / )" className="input max-w-md rounded-full px-4" />
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Link key={t} href={href({ type: sp.type === t ? undefined : t })} className={`chip ${sp.type === t ? "!border-ink" : ""}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_META[t].hex }} />
            {TYPE_META[t].label}
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" />
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: sp.status === s ? undefined : s })} className={`chip capitalize ${sp.status === s ? "!border-ink" : ""}`}>{s}</Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" />
        <Link href={href({ unsorted: sp.unsorted ? undefined : "1" })} className={`chip ${sp.unsorted ? "!border-ink" : ""}`}>Unsorted ({unsortedCount})</Link>
        <span className="mx-1 w-px self-stretch bg-line" />
        {[["", "A to Z"], ["due", "Most overdue"], ["recent", "Recently talked"], ["strength", "Strongest"]].map(([k, l]) => (
          <Link key={k} href={href({ sort: k || undefined })} className={`chip ${(sp.sort ?? "") === k ? "!border-ink" : ""}`}>{l}</Link>
        ))}
      </div>

      <PeopleGrid
        items={visible.map(({ c, d }) => {
          const hot = d.daysOverdue != null && d.daysOverdue >= 0;
          return {
            c, hot,
            dueText: hot ? relDays(d.daysOverdue) : sinceText(c.last_contact_at),
            nextText: d.nextDue ? relDays(d.daysOverdue) : "Not scheduled",
            lastText: sinceText(c.last_contact_at).replace("Talked ", ""),
          };
        })}
      />
      <Pager page={pg.page} pages={pg.pages} start={pg.start} shown={visible.length} total={pg.total} href={(n) => href({ page: n > 1 ? String(n) : undefined })} />
      {list.length === 0 && <p className="py-16 text-center text-muted">No one matches. <Link className="underline" href="/people">Clear filters</Link></p>}
    </>
  );
}
