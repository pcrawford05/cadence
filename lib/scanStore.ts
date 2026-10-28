"use client";
/**
 * One recap scan per day per device, owned by the app shell, not the Recap page.
 * It survives navigation, so leaving and coming back shows the same run (or its result).
 */
export type ScanState = { phase: "idle" | "sync" | "draft" | "done" | "error"; msg: string; at: string | null; pending: number };

const KEY = "cadence.recapScan";
let state: ScanState = { phase: "idle", msg: "", at: null, pending: 0 };
const subs = new Set<() => void>();
const set = (s: Partial<ScanState>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };

if (typeof window !== "undefined") {
  try { const saved = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (saved?.at) state = { phase: saved.phase === "error" ? "error" : "done", msg: saved.msg ?? "", at: saved.at, pending: 0 }; } catch {}
}

const SERVER: ScanState = { phase: "idle", msg: "", at: null, pending: 0 };

export const scanStore = {
  server: () => SERVER,
  get: () => state,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  busy: () => state.phase === "sync" || state.phase === "draft",
  /** True when this device hasn't checked today. */
  due: () => !state.at || new Date(state.at).toDateString() !== new Date().toDateString(),
  /** Refresh the badge count (cheap). */
  async count() {
    try { const j = await fetch("/api/recap/scan").then((r) => r.json()); set({ pending: j.pending ?? 0 }); } catch {}
  },
  setPending: (n: number) => set({ pending: n }),
  async run(force = false) {
    if (scanStore.busy()) return;
    const step = async (s: "sync" | "draft") => {
      const r = await fetch(`/api/recap/scan?step=${s}${force ? "&force=1" : ""}`, { method: "POST" });
      const j = await r.json().catch(() => ({ ok: false, error: `Scan failed (${r.status}). Try again.` }));
      if (!j.ok) throw new Error(j.error ?? "Scan failed");
      return j as { added?: number; more?: boolean; connected?: boolean; pending?: number };
    };
    try {
      set({ phase: "sync", msg: "" });
      const s = await step("sync");
      if (s.connected === false) { set({ phase: "idle" }); return; }
      set({ phase: "draft" });
      // Drafting goes in rounds so each request stays well under the server's time limit.
      let added = 0;
      for (let round = 0; round < 6; round++) {
        const d = await step("draft");
        added += d.added ?? 0;
        set({ pending: d.pending ?? state.pending });
        if (!d.more) break;
      }
      set({ phase: "done", at: new Date().toISOString(), msg: added ? `Found ${added} new ${added === 1 ? "conversation" : "conversations"}` : "You're up to date" });
    } catch (e) {
      set({ phase: "error", msg: (e as Error).message, at: new Date().toISOString() });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    window.dispatchEvent(new Event("cadence:recap-updated"));
  },
};
