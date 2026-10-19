import { saveContact } from "@/app/actions";
import { StrengthPicker } from "./Strength";
import { Contact, STATUSES, TYPES, TYPE_META } from "@/lib/types";

export default function ContactForm({ c }: { c?: Contact }) {
  const action = saveContact.bind(null, c?.id ?? null);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" required defaultValue={c?.name} />
        <Field name="company" label="Company" defaultValue={c?.company} />
        <Field name="position" label="Position" defaultValue={c?.position} />
        <Field name="location" label="Location" defaultValue={c?.location} />
        <Field name="emails" label="Emails (comma separated)" defaultValue={c?.emails.join(", ")} hint="Used to match Gmail and Calendar" />
        <Field name="linkedin_url" label="LinkedIn URL" defaultValue={c?.linkedin_url} />
        <Field name="phone" label="Phone" defaultValue={c?.phone} />
        <Field name="date_met" label="Date met" type="date" defaultValue={c?.date_met} />
        {!c && <Field name="last_talked" label="Last talked (optional)" type="date" />}
      </div>

      <div>
        <span className="label">Photo</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="photo_file" type="file" accept="image/*" className="input file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:text-paper" />
          <input name="photo_url" defaultValue={c?.photo_url?.startsWith("/api/photo") ? "" : c?.photo_url ?? ""} placeholder="or paste an image URL" className="input" />
        </div>
      </div>

      <fieldset>
        <legend className="label">Type (cadence)</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <label key={t} className="chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-paper">
              <input type="radio" name="type" value={t} defaultChecked={c?.type === t} className="sr-only" />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_META[t].hex }} />
              {TYPE_META[t].label} <span className="text-muted">· {TYPE_META[t].blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <label key={s} className="chip cursor-pointer capitalize has-[:checked]:border-ink has-[:checked]:bg-paper">
              <input type="checkbox" name="statuses" value={s} defaultChecked={c?.statuses.includes(s)} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
      </fieldset>

      <StrengthPicker value={c?.strength} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="priority_due" label="Priority deadline" type="date" defaultValue={c?.priority_due} hint="Used when Priority is on" />
        <Field name="cadence_days_override" label="Custom cadence (days)" type="number" defaultValue={c?.cadence_days_override?.toString()} hint="Overrides the type" />
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={4} defaultValue={c?.notes ?? ""} className="input" />
      </div>

      <button className="btn-primary px-5 py-2">{c ? "Save changes" : "Add person"}</button>
    </form>
  );
}

function Field({ name, label, defaultValue, type = "text", required, hint }: { name: string; label: string; defaultValue?: string | null; type?: string; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} defaultValue={defaultValue ?? ""} className="input" />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
