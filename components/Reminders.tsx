"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleReminder } from "@/app/actions";
import { badgeStore, refreshBadge } from "@/lib/badgeStore";
import type { Reminder } from "@/lib/repo";

/** Today's custom reminders. They only clear when checked here; they come back tomorrow. */
export default function Reminders({ items, today }: { items: Reminder[]; today: string }) {
  const [done, setDone] = useState(() => new Set(items.filter((r) => r.done_on === today).map((r) => r.id)));
  const [, start] = useTransition();
  if (!items.length) return null;
  const left = items.length - done.size;

  const flip = (id: string) => {
    const on = !done.has(id);
    setDone((d) => { const n = new Set(d); if (on) n.add(id); else n.delete(id); return n; });
    badgeStore.bump("reminders", on ? -1 : 1);
    start(async () => { await toggleReminder(id, on); refreshBadge(); });
  };

  return (
    <section className="mb-6 rounded-3xl border border-line bg-card p-4 sm:p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Today</h2>
        <span className="text-xs text-muted">{left ? `${left} left` : "All done"} · <Link href="/settings#reminders" className="underline">Edit</Link></span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((r) => {
          const on = done.has(r.id);
          return (
            <li key={r.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input type="checkbox" checked={on} onChange={() => flip(r.id)} className="peer sr-only" />
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? "border-accent bg-accent text-white" : "border-line"}`}>
                  {on && <svg viewBox="0 0 24 24" className="check-in h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                </span>
                <span className={`text-[15px] transition-colors ${on ? "text-muted line-through" : ""}`}>{r.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
