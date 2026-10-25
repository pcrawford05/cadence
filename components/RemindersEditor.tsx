"use client";
import { useState, useTransition } from "react";
import { saveReminders } from "@/app/actions";
import { refreshBadge } from "@/lib/badgeStore";
import type { Reminder } from "@/lib/repo";

/** Settings: any number of daily reminders. Saves when you leave a field. */
export default function RemindersEditor({ initial }: { initial: Reminder[] }) {
  const [rows, setRows] = useState(() => (initial.length ? initial : [{ id: "", text: "", done_on: null }]).map((r) => ({ id: r.id, text: r.text })));
  const [state, setState] = useState<"" | "saving" | "saved">("");
  const [, start] = useTransition();
  const save = (next = rows) => {
    setState("saving");
    start(async () => {
      const out = await saveReminders(next);
      setRows(out.length ? out.map((r) => ({ id: r.id, text: r.text })) : [{ id: "", text: "" }]);
      setState("saved"); refreshBadge();
      setTimeout(() => setState(""), 1500);
    });
  };
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.id || `new-${i}`} className="flex items-center gap-2">
          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line" aria-hidden />
          <input
            value={r.text}
            placeholder="Apply for 5 jobs"
            aria-label={`Reminder ${i + 1}`}
            onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}
            onBlur={() => save()}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="input rounded-full placeholder:text-muted/60"
          />
          {(rows.length > 1 || r.text) && (
            <button type="button" aria-label="Remove reminder" onClick={() => { const next = rows.filter((_, j) => j !== i); setRows(next.length ? next : [{ id: "", text: "" }]); save(next); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink">✕</button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={() => setRows((x) => [...x, { id: "", text: "" }])} className="btn-ghost">+ Add reminder</button>
        <span className="text-xs text-muted" aria-live="polite">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</span>
      </div>
    </div>
  );
}
