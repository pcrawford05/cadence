"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, StatusPills } from "./ui";
import { StrengthBadge } from "./Strength";
import { markTalked, setLastTalked, snooze } from "@/app/actions";
import { EditStatuses, EditStrength, EditText, EditType, EditableProvider } from "./Editable";
import type { Contact } from "@/lib/types";

export type GridItem = { c: Contact; dueText: string; hot: boolean; lastText: string; nextText: string };

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

export default function PeopleGrid({ items }: { items: GridItem[] }) {
  const [peek, setPeek] = useState<number | null>(null);
  const hovered = useRef<number | null>(null);

  // Space peeks the hovered card (like Quick Look); arrows move while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return;
      if (peek === null) {
        if (e.key === " " && hovered.current !== null) { e.preventDefault(); setPeek(hovered.current); }
        return;
      }
      if (e.key === "Escape" || e.key === " ") { e.preventDefault(); setPeek(null); }
      if (e.key === "ArrowRight") { e.preventDefault(); setPeek((p) => Math.min(items.length - 1, (p ?? 0) + 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setPeek((p) => Math.max(0, (p ?? 0) - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek, items.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ c, dueText, hot }, i) => (
          <div
            key={c.id}
            className="group relative"
            onMouseEnter={() => (hovered.current = i)}
            onMouseLeave={() => (hovered.current = null)}
          >
            <Link
              href={`/contacts/${c.id}`}
              className="flex h-full flex-col items-center rounded-3xl border border-line bg-card px-3 pb-4 pt-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Avatar c={c} size={96} />
              <h3 className="mt-3 line-clamp-1 font-semibold">{c.name}</h3>
              <p className="line-clamp-1 text-xs text-muted">{c.company || c.location || " "}</p>
              <p className={`mt-2 text-xs font-medium ${hot ? "text-red-600 dark:text-red-400" : "text-muted"}`}>{dueText}</p>
              <div className="mt-2 flex justify-center"><StrengthBadge value={c.strength} /></div>
              <div className="mt-2 flex justify-center"><StatusPills statuses={c.statuses} /></div>
            </Link>
            <button
              type="button"
              onClick={() => setPeek(i)}
              aria-label={`Peek at ${c.name}`}
              title="Peek (Space)"
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted shadow-sm transition hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {peek !== null && items[peek] && (
        <Peek item={items[peek]} pos={`${peek + 1} of ${items.length}`} onClose={() => setPeek(null)}
          onPrev={peek > 0 ? () => setPeek(peek - 1) : undefined}
          onNext={peek < items.length - 1 ? () => setPeek(peek + 1) : undefined} />
      )}
    </>
  );
}

function Peek({ item, pos, onClose, onPrev, onNext }: { item: GridItem; pos: string; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  const { c, nextText, lastText, hot } = item;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState("");
  useEffect(() => setDone(""), [c.id]);

  const act = (label: string, fn: () => Promise<unknown>) => start(async () => {
    try { await fn(); setDone(label); router.refresh(); } catch (e) { setDone(`Couldn't save: ${(e as Error).message}`); }
  });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center scrim sm:items-center sm:px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={`${c.name} details`}
        onMouseDown={(e) => e.stopPropagation()}
        className="glass sheet w-full max-w-md rounded-t-[32px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px] sm:pb-5"
      >
        <div className="flex items-start gap-4">
          <Avatar c={c} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-semibold leading-tight">{c.name}</h2>
            <p className="truncate text-sm text-muted">{[c.position, c.company].filter(Boolean).join(" at ") || "No title"}</p>
            {c.location && <p className="truncate text-xs text-muted">{c.location}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-1.5 text-muted hover:bg-paper hover:text-ink">✕</button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Cell k="Next" v={nextText} hot={hot} />
          <div className="rounded-xl bg-paper px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted">Last talked</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span className="truncate">{lastText}</span>
              <label className="ml-auto shrink-0 cursor-pointer text-xs font-normal text-accent hover:underline">
                Set
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  className="sr-only"
                  aria-label={`When you last talked with ${c.name}`}
                  onChange={(e) => e.target.value && act("Set last talked", () => setLastTalked(c.id, e.target.value))}
                />
              </label>
            </dd>
          </div>
        </dl>

        {/* Same inline editors as the profile: each change saves on its own. */}
        <EditableProvider id={c.id}>
          <div key={c.id} className="mt-4 max-h-[42vh] space-y-4 overflow-y-auto pr-1">
            <EditType value={c.type} />
            <EditStrength value={c.strength} />
            <EditStatuses value={c.statuses} />
            <EditText field="notes" value={c.notes} label="Notes" placeholder="How you know them, what to follow up on" multiline />
          </div>
        </EditableProvider>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {c.emails[0] && <a className="text-accent hover:underline" href={`mailto:${c.emails[0]}`}>{c.emails[0]}</a>}
          {c.phone && <a className="text-accent hover:underline" href={`sms:${c.phone}`}>{c.phone}</a>}
          {c.linkedin_url && <a className="text-accent hover:underline" href={c.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button disabled={pending} onClick={() => act("Logged a conversation", () => markTalked(c.id))} className="btn-primary">Talked</button>
          <button disabled={pending} onClick={() => act("Snoozed a week", () => snooze(c.id, 7))} className="btn-ghost">+1w</button>
          <Link href={`/contacts/${c.id}`} className="btn-ghost ml-auto">Open profile →</Link>
        </div>
        {done && <p className="mt-2 text-xs text-accent">✓ {done}</p>}

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <button disabled={!onPrev} onClick={onPrev} className="rounded-full px-2 py-1 hover:bg-paper disabled:opacity-30">← Prev</button>
          <span>{pos} · Space or Esc to close</span>
          <button disabled={!onNext} onClick={onNext} className="rounded-full px-2 py-1 hover:bg-paper disabled:opacity-30">Next →</button>
        </div>
      </div>
    </div>
  );
}

function Cell({ k, v, hot }: { k: string; v: React.ReactNode; hot?: boolean }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
      <dd className={`font-medium ${hot ? "text-red-600 dark:text-red-400" : ""}`}>{v}</dd>
    </div>
  );
}
