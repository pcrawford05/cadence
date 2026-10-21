import { notFound } from "next/navigation";
import { getRepo } from "@/lib/session";
import { computeDue, suggestStatuses } from "@/lib/cadence";
import { StatusPills, relDays, sinceText } from "@/components/ui";
import QuickActions from "@/components/QuickActions";
import { deleteContact, logInteraction } from "@/app/actions";
import { TYPE_META } from "@/lib/types";
import PhotoDrop from "@/components/PhotoDrop";
import { EditStatuses, EditStrength, EditText, EditType, EditableProvider } from "@/components/Editable";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { gmail: "Email", calendar: "Meeting", manual: "Logged", mcp: "Agent", import: "Imported" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [c, interactions, settings] = await Promise.all([repo.getContact(id), repo.listInteractions(id), repo.getSettings()]);
  if (!c) notFound();
  const now = new Date();
  const d = computeDue(c, now, settings.cadence);
  const suggested = suggestStatuses(c, now, settings.cadence);
  const suggestionDiffers = suggested.slice().sort().join() !== c.statuses.slice().sort().join();
  const cadenceLabel = c.cadence_days_override ? `Every ${c.cadence_days_override} days` : c.type ? TYPE_META[c.type].blurb : "No cadence";

  return (
    <EditableProvider id={c.id}>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5 rounded-3xl border border-line bg-card p-6 lg:sticky lg:top-20 lg:self-start">
          <div className="flex justify-center"><PhotoDrop id={c.id} name={c.name} photo={c.photo_url} type={c.type} size={144} pageLevel /></div>
          <div className="text-center">
            <EditText field="name" value={c.name} inputClassName="text-center font-display text-3xl font-semibold leading-tight" />
            <EditText field="position" value={c.position} placeholder="Add position" inputClassName="text-center text-muted" />
            <EditText field="company" value={c.company} placeholder="Add company" inputClassName="text-center text-muted" />
            <EditText field="location" value={c.location} placeholder="Add location" inputClassName="text-center text-sm text-muted" />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-left text-sm">
            <Stat k="Next" v={d.nextDue ? relDays(d.daysOverdue) : "Not scheduled"} hot={(d.daysOverdue ?? -1) >= 0} />
            <Stat k="Last" v={sinceText(c.last_contact_at).replace("Talked ", "")} />
          </dl>
          <div className="flex justify-center"><QuickActions id={c.id} compact /></div>

          <div className="space-y-4 border-t border-line pt-5">
            <EditType value={c.type} />
            <p className="-mt-2 text-xs text-muted">{cadenceLabel}</p>
            <EditStrength value={c.strength} />
            <EditStatuses value={c.statuses} />
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-sm">
            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="btn-ghost">LinkedIn</a>}
            {c.emails[0] && <a href={`mailto:${c.emails[0]}`} className="btn-ghost">Email</a>}
            {c.phone && <a href={`sms:${c.phone}`} className="btn-ghost">Text</a>}
          </div>
        </aside>

        <section className="space-y-6">
          {suggestionDiffers && suggested.length > 0 && (
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
              Based on recency, status could be <StatusPills statuses={suggested} />
            </div>
          )}

          <div className="rounded-3xl border border-line bg-card p-5">
            <EditText field="notes" value={c.notes} label="Notes" placeholder="How you know them, what to follow up on…" multiline />
          </div>

          <div className="grid gap-x-6 gap-y-4 rounded-3xl border border-line bg-card p-5 sm:grid-cols-2">
            <EditText field="emails" value={c.emails.join(", ")} label="Emails" placeholder="Add email (used for Gmail sync)" />
            <EditText field="phone" value={c.phone} label="Phone" type="tel" placeholder="Add phone" />
            <EditText field="linkedin_url" value={c.linkedin_url} label="LinkedIn" type="url" placeholder="Paste profile URL" />
            <EditText field="date_met" value={c.date_met} label="Date met" type="date" placeholder="Add date" format="date" />
            <EditText field="priority_due" value={c.priority_due} label="Priority deadline" type="date" placeholder="None" format="date" />
            <EditText field="cadence_days_override" value={c.cadence_days_override?.toString() ?? null} label="Custom cadence (days)" type="number" placeholder="Use type" format="days" />
          </div>

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

          <details className="group px-1 text-sm">
            <summary className="cursor-pointer list-none text-muted hover:text-red-600">Delete {c.name}…</summary>
            <form action={deleteContact.bind(null, c.id)} className="mt-2 flex items-center gap-3">
              <span className="text-muted">This removes them and their history.</span>
              <button className="btn border border-red-500/40 text-red-600 hover:bg-red-500/10">Delete permanently</button>
            </form>
          </details>
        </section>
      </div>
    </EditableProvider>
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
