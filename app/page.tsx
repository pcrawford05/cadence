import Link from "next/link";
import { currentUser, getRepo } from "@/lib/session";
import Landing from "@/components/landing/Landing";
import { computeDue, dueList } from "@/lib/cadence";
import { Avatar, ContactLink, PageHeader, StatusPills, relDays, sinceText } from "@/components/ui";
import QuickActions from "@/components/QuickActions";
import { TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DuePage() {
  if (!(await currentUser())) return <Landing />;
  const repo = await getRepo();
  const [bare, settings] = await Promise.all([repo.listContactsBare(), repo.getSettings()]);
  const now = new Date();
  // Sign photos only for the people this page shows.
  const shown = new Set([
    ...dueList(bare, now, settings.cadence).map((x) => x.contact.id),
    ...bare.filter((c) => { const d = computeDue(c, now, settings.cadence).daysOverdue; return d != null && d < 0 && d >= -14; }).map((c) => c.id),
    ...bare.filter((c) => c.statuses.includes("new") && !c.last_contact_at && !c.date_met).map((c) => c.id),
  ]);
  const signed = new Map((await repo.withPhotos(bare.filter((c) => shown.has(c.id)))).map((c) => [c.id, c]));
  const contacts = bare.map((c) => signed.get(c.id) ?? c);
  const due = dueList(contacts, now, settings.cadence);
  const upcoming = contacts
    .map((c) => ({ contact: c, due: computeDue(c, now, settings.cadence) }))
    .filter((x) => x.due.daysOverdue != null && x.due.daysOverdue < 0 && x.due.daysOverdue >= -14)
    .sort((a, b) => (b.due.daysOverdue ?? 0) - (a.due.daysOverdue ?? 0));
  const unscheduled = contacts.filter((c) => c.statuses.includes("new") && !c.last_contact_at && !c.date_met);

  const today = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader
        title={due.length ? `${due.length} to reach out to` : "You're all caught up"}
        sub={today}
        action={<Link href="/people" className="btn-ghost hidden sm:inline-flex">All {contacts.length} people</Link>}
      />

      {due.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2">
          {due.map(({ contact: c, due: d }) => {
            const over = d.daysOverdue ?? 0;
            return (
              <article key={c.id} className="rounded-3xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(0,0,0,.03)]">
                <div className="flex gap-4">
                  <ContactLink c={c}><Avatar c={c} size={72} /></ContactLink>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <ContactLink c={c} className="min-w-0">
                        <h2 className="truncate text-lg font-semibold leading-tight">{c.name}</h2>
                        <p className="truncate text-sm text-muted">{[c.company, c.location].filter(Boolean).join(" · ") || " "}</p>
                      </ContactLink>
                      <span className={`hidden shrink-0 rounded-full px-2.5 sm:inline-block py-1 text-xs font-semibold ${over > 14 ? "bg-red-500/10 text-red-600 dark:text-red-400" : over > 0 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-accent/10 text-accent"}`}>
                        {d.reason === "priority" && over <= 0 ? "Priority" : relDays(over)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className={`font-semibold sm:hidden ${over > 0 ? "text-red-600 dark:text-red-400" : "text-accent"}`}>{d.reason === "priority" && over <= 0 ? "Priority" : relDays(over)}</span>
                      <span>{sinceText(c.last_contact_at)}</span>
                      {c.type && <span>{TYPE_META[c.type].blurb}</span>}
                      <StatusPills statuses={c.statuses} />
                    </div>
                    {c.notes && <p className="mt-2 line-clamp-1 text-sm italic text-muted">{c.notes}</p>}
                  </div>
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <QuickActions id={c.id} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Coming up in the next two weeks</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {upcoming.map(({ contact: c, due: d }) => (
              <ContactLink key={c.id} c={c} className="flex w-24 shrink-0 flex-col items-center text-center">
                <Avatar c={c} size={64} />
                <span className="mt-2 line-clamp-1 text-sm font-medium">{c.name.split(" ")[0]}</span>
                <span className="text-xs text-muted">{relDays(d.daysOverdue).replace("Due in ", "in ")}</span>
              </ContactLink>
            ))}
          </div>
        </section>
      )}

      {unscheduled.length > 0 && (
        <section className="mt-8 rounded-2xl border border-dashed border-line p-4 text-sm">
          <p className="font-medium">{unscheduled.length} new {unscheduled.length === 1 ? "person has" : "people have"} no dates yet</p>
          <p className="mt-1 text-muted">They won&apos;t come due until you log a conversation or set a date met.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unscheduled.map((c) => (
              <ContactLink key={c.id} c={c} className="chip">{c.name}</ContactLink>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
