"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { sendFeedback } from "@/app/actions";

export function openFeedback() {
  window.dispatchEvent(new CustomEvent("cadence:feedback"));
}

/** Small modal; submit, see a thank-you, keep working. Opened from the header, Settings, or F. */
export default function Feedback() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("idea");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const o = () => { setOpen(true); setDone(false); setErr(""); };
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Escape") setOpen(false);
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !(t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        if (!document.querySelector('[role="dialog"]')) { e.preventDefault(); o(); }
      }
    };
    window.addEventListener("cadence:feedback", o);
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("cadence:feedback", o); window.removeEventListener("keydown", k); };
  }, []);

  if (!open || path === "/login") return null;

  const submit = () => start(async () => {
    setErr("");
    let r: { ok: boolean; error?: string };
    try {
      r = await sendFeedback({ kind, message: msg, page: path, userAgent: navigator.userAgent });
    } catch (e) {
      if (/Server Action/i.test(String(e))) { setErr("Cadence just updated. Reloading so you can send…"); setTimeout(() => location.reload(), 1200); return; }
      return setErr("Couldn't send. Check your connection and try again.");
    }
    if (!r.ok) return setErr(r.error ?? "Couldn't send your feedback. Try again.");
    setDone(true); setMsg("");
    setTimeout(() => setOpen(false), 1800);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center scrim sm:items-center sm:px-4" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-label="Send feedback" onMouseDown={(e) => e.stopPropagation()} className="glass sheet w-full max-w-md rounded-t-[32px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px] sm:pb-5">
        {done ? (
          <div className="py-8 text-center">
            <p className="font-display text-2xl">Thank you</p>
            <p className="mt-1 text-sm text-muted">Peyton will see this shortly.</p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold">Send feedback</h2>
            <p className="mt-0.5 text-sm text-muted">Ideas, bugs, anything. Goes straight to Peyton.</p>
            <div className="mt-4 flex gap-1.5">
              {[["idea", "Idea"], ["bug", "Bug"], ["other", "Other"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`chip ${kind === k ? "!border-ink bg-paper" : ""}`}>{l}</button>
              ))}
            </div>
            <textarea
              autoFocus
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              rows={5}
              maxLength={5000}
              placeholder={kind === "bug" ? "What happened, and what did you expect?" : "What would make Cadence better?"}
              className="input mt-3"
            />
            <p className="mt-1 text-xs text-muted">Includes the page you're on ({path}) so it's easy to find.</p>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
              <button type="button" disabled={pending || !msg.trim()} onClick={submit} className="btn-primary">{pending ? "Sending…" : "Send ⌘↵"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
