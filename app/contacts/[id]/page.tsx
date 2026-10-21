import { notFound } from "next/navigation";
import { getRepo } from "@/lib/session";
import { computeDue, suggestStatuses } from "@/lib/cadence";
import { Avatar, StatusPills, TypeDot, relDays, sinceText } from "@/components/ui";
import QuickActions from "@/components/QuickActions";
import ContactForm from "@/components/ContactForm";
import { deleteContact, logInteraction } from "@/app/actions";
import { TYPE_META } from "@/lib/types";
import { StrengthBadge } from "@/components/Strength";
import PhotoDrop from "@/components/PhotoDrop";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { gmail: "Email", calendar: "Meeting", manual: "Logged", mcp: "Agent", import: "Imported" };

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params;
  const { edit } = await searchParams;
  const repo = await getRepo();
  const c = await repo.getContact(id);
  if (!c) notFound();
  const [interactions, settings] = await Promise.all([repo.listInteractions(id), repo.getSettings()]);
  const now = new Date();
  const d = computeDue(c, now, settings.cadence);
  const suggested = suggestStatuses(c, now, settings.cadence);
  const suggestionDiffers = suggested.slice().sort().join() !== c.statuses.slice().sort().join();

  if (edit) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Avatar c={c} size={64} />
          <h1 className="font-display text-3xl font-semibold">Edit {c.name.split(" ")[0]}</h1>
        </div>
        <div className="rounded-3xl border border-line bg-card p-5 sm:p-7"><ContactForm c={c} /></div>
        <form action={deleteContact.bind(null, c.id)} className="mt-6 text-right">
          <button className="text-sm text-red-600 hover:underline">Delete {c.name}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-3xl border border-line bg-card p-6 text-center lg:sticky lg:top-20 lg:self-start">
        <div className="flex justify-center"><PhotoDrop id={c.id} name={c.name} photo={c.photo_url} type={c.type} size={144} pageLevel /></div>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">{c.name}</h1>
        <p className="text-muted">{[c.position, c.company].filter(Boolean).join(" at ")}{c.location ? ` · ${c.location}` : ""}</p>
        <div className="mt-3 flex justify-center"><StatusPills statuses={c.statuses} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-left text-sm">
          <Stat k="Next" v={d.nextDue ? relDays(d.daysOverdue) : "Not scheduled"} hot={(d.daysOverdue ?? -1) >= 0} />
          <Stat k="Last" v={sinceText(c.last_contact_at).replace("Talked ", "")} />
          <Stat k="Type" v={<TypeDot type={c.type} />} />
          <Stat k="Strength" v={<StrengthBadge value={c.strength} showLabel />} />
          <Stat k="Source" v={c.source === "linkedin" ? "LinkedIn" : c.source === "import" ? "Spreadsheet" : "Added here"} />
          <Stat k="Cadence" v={c.cadence_days_override ? `Every ${c.cadence_days_override}d` : c.type ? TYPE_META[c.type].blurb : "None"} />
        </dl>
        <div className="mt-5 flex justify-center"><QuickActions id={c.id} compact /></div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
          {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="btn-ghost">LinkedIn</a>}
          {c.emails[0] && <a href={`mailto:${c.emails[0]}`} className="btn-ghost">Email</a>}
          <a href={`/contacts/${c.id}?edit=1`} className="btn-ghost">Edit</a>
        </div>
      </aside>

      <section className="space-y-6">
        {suggestionDiffers && suggested.length > 0 && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
            Based on recency, status could be <StatusPills statuses={suggested} />
          </div>
        )}

        {c.notes && (
          <div className="rounded-3xl border border-line bg-card p-5">
            <h2 className="label">Notes</h2>
            <p className="whitespace-pre-wrap">{c.notes}</p>
          </div>
        )}

        <div className="rounded-3xl border border-line bg-card p-5">
          <h2 className="label">Log a conversation</h2>
          <form action={logInteraction.bind(null, c.id)} className="mt-2 grid gap-2 sm:grid-cols-[140px_130px_1fr_auto]">
            <input type="date" name="date" defaultValue={now.toISOString().slice(0, 10)} className="input" />
            <select name="kind" className="input">
              <option value="meeting">Coffee chat</option>
              <option value="call">Call</option>
              <option value="manual">Other</option>
            </select>
            <input name="summary" placeholder="What did you talk about?" className="input" />
            <button className="btn-primary">Log</button>
          </form>
        </div>

        <div className="rounded-3xl border border-line bg-card p-5">
          <h2 className="label">Timeline</h2>
          {interactions.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet. Gmail and Calendar sync will fill this in.</p>
          ) : (
            <ol className="relative mt-3 space-y-4 border-l border-line pl-5">
              {interactions.map((i) => (
                <li key={i.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-accent" />
                  <p className="text-sm font-medium">{i.summary ?? SOURCE_LABEL[i.source]}</p>
                  <p className="text-xs text-muted">
                    {new Date(i.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {SOURCE_LABEL[i.source]}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v, hot }: { k: string; v: React.ReactNode; hot?: boolean }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
      <dd className={`font-medium ${hot ? "text-red-600 dark:text-red-400" : ""}`}>{v}</dd>
    </div>
  );
}
