import Link from "next/link";
import { getRepo } from "@/lib/session";
import { computeDue } from "@/lib/cadence";
import { Avatar, ContactLink, PageHeader, StatusPills, relDays, sinceText } from "@/components/ui";
import { STATUSES, TYPES, TYPE_META } from "@/lib/types";
import { StrengthBadge } from "@/components/Strength";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; type?: string; status?: string; sort?: string; unsorted?: string }>;

export default async function PeoplePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [all, settings] = await Promise.all([repo.listContacts(), repo.getSettings()]);
  const q = (sp.q ?? "").toLowerCase();
  const now = new Date();

  const unsortedCount = all.filter((c) => !c.triaged_at).length;
  let list = all
    .filter((c) => (sp.unsorted ? !c.triaged_at : !!c.triaged_at))
    .filter((c) => !sp.type || c.type === sp.type)
    .filter((c) => !sp.status || c.statuses.includes(sp.status as never))
    .filter((c) => !q || [c.name, c.company, c.location, c.notes].some((v) => v?.toLowerCase().includes(q)))
    .map((c) => ({ c, d: computeDue(c, now, settings.cadence) }));

  if (sp.sort === "due") list = list.sort((a, b) => (b.d.daysOverdue ?? -1e9) - (a.d.daysOverdue ?? -1e9));
  if (sp.sort === "strength") list = list.sort((a, b) => (b.c.strength ?? 0) - (a.c.strength ?? 0));
  if (sp.sort === "recent") list = list.sort((a, b) => (b.c.last_contact_at ?? "").localeCompare(a.c.last_contact_at ?? ""));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
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
        <input name="q" defaultValue={sp.q} placeholder="Search name, company, notes" className="input max-w-md rounded-full px-4" />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {list.map(({ c, d }) => (
          <ContactLink key={c.id} c={c} className="group flex flex-col items-center rounded-3xl border border-line bg-card px-3 pb-4 pt-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg">
            <Avatar c={c} size={96} />
            <h3 className="mt-3 line-clamp-1 font-semibold">{c.name}</h3>
            <p className="line-clamp-1 text-xs text-muted">{c.company || c.location || " "}</p>
            <p className={`mt-2 text-xs font-medium ${d.daysOverdue != null && d.daysOverdue >= 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
              {d.daysOverdue != null && d.daysOverdue >= 0 ? relDays(d.daysOverdue) : sinceText(c.last_contact_at)}
            </p>
            <div className="mt-2 flex justify-center"><StrengthBadge value={c.strength} /></div>
            <div className="mt-2 flex justify-center"><StatusPills statuses={c.statuses} /></div>
          </ContactLink>
        ))}
      </div>
      {list.length === 0 && <p className="py-16 text-center text-muted">No one matches. <Link className="underline" href="/people">Clear filters</Link></p>}
    </>
  );
}
