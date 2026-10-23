"use client";
import { useState, useTransition } from "react";
import PhotoDrop from "./PhotoDrop";
import { StrengthPicker } from "./Strength";
import { archiveFromInbox, triage } from "@/app/actions";
import { TYPES, TYPE_META, type ContactType } from "@/lib/types";

type Props = {
  c: { id: string; name: string; photo_url: string | null; type: ContactType | null; position: string | null; company: string | null; linkedin_url: string | null };
  connected: string | null;
};

/** One inbox person. Saving collapses the card at once (one tap), then the server catches up. */
export default function InboxCard({ c, connected }: Props) {
  const [leaving, setLeaving] = useState<"" | "saved" | "skipped">("");
  const [type, setType] = useState<ContactType>("purple");
  const [, start] = useTransition();

  const go = (kind: "saved" | "skipped", form: HTMLFormElement) => {
    if (leaving) return;
    const fd = new FormData(form);
    setLeaving(kind);
    start(async () => {
      await new Promise((r) => setTimeout(r, 820)); // let the fold finish before the list re-renders
      try { kind === "saved" ? await triage(c.id, fd) : await archiveFromInbox(c.id); }
      catch { setLeaving(""); }
    });
  };

  return (
    <div className={`inbox-row grid ${leaving ? "is-leaving" : ""}`} aria-hidden={!!leaving}>
      <div className="min-h-0 overflow-hidden">
        <article className="relative mb-4 rounded-3xl border border-line bg-card p-5">
          {leaving && (
            <div className="inbox-stamp absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-3xl bg-card text-base font-semibold text-accent">
              {leaving === "saved" ? `✓ ${c.name} sorted` : `${c.name} archived`}
            </div>
          )}
          <div className="flex items-start gap-4">
            <PhotoDrop id={c.id} name={c.name} photo={c.photo_url} type={type} size={72} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight">{c.name}</h2>
              <p className="text-sm text-muted">{[c.position, c.company].filter(Boolean).join(" at ") || "No title on LinkedIn"}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                {connected && <span>Connected {connected}</span>}
                {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="underline">Open LinkedIn to copy photo</a>}
              </div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); go("saved", e.currentTarget); }} className="mt-4 space-y-4">
            <label className="block">
              <span className="label">How often to reach out</span>
              <div className="relative max-w-sm">
                <span className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ background: TYPE_META[type].hex }} />
                <select name="type" value={type} onChange={(e) => setType(e.target.value as ContactType)} className="input appearance-none rounded-full pl-8 pr-9">
                  {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].blurb}</option>)}
                </select>
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </label>
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
              <button type="submit" disabled={!!leaving} className="btn-primary">Save</button>
              <button type="button" disabled={!!leaving} onClick={(e) => go("skipped", e.currentTarget.form!)} className="btn-ghost">Not someone to track</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  );
}
