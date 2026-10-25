"use client";
/** Red-number counts for the tab bar and the home-screen app icon. */
export type Badge = { inbox: number; recap: number; reminders: number; total: number };
const EMPTY: Badge = { inbox: 0, recap: 0, reminders: 0, total: 0 };
let state = EMPTY;
const subs = new Set<() => void>();
let inflight: Promise<void> | null = null;

export const badgeStore = {
  get: () => state,
  server: () => EMPTY,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  /** Optimistic nudge (e.g. a reminder was checked) before the server confirms. */
  bump(k: "inbox" | "recap" | "reminders", by: number) {
    const v = Math.max(0, state[k] + by);
    state = { ...state, [k]: v, total: Math.max(0, state.total + (v - state[k])) };
    apply();
  },
  refresh() {
    inflight ??= fetch("/api/badge").then((r) => r.json()).then((b: Badge) => { state = b; apply(); }).catch(() => {}).finally(() => { inflight = null; });
    return inflight;
  },
};

function apply() {
  subs.forEach((f) => f());
  // Home-screen icon badge (installed app with notifications allowed; ignored elsewhere).
  try {
    const n = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (state.total > 0) n.setAppBadge?.(state.total).catch(() => {}); else n.clearAppBadge?.().catch(() => {});
  } catch {}
}

if (typeof window !== "undefined") addEventListener("cadence:badge", () => badgeStore.refresh());
export const refreshBadge = () => { if (typeof window !== "undefined") dispatchEvent(new Event("cadence:badge")); };
