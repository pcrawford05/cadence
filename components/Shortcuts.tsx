"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { paletteIndex } from "@/app/actions";
import { TYPE_META, type ContactType } from "@/lib/types";

type Person = { id: string; name: string; sub: string; photo: string | null; type: ContactType | null; sorted: boolean };
type Item = { kind: "go" | "person"; label: string; sub?: string; href: string; hint?: string; person?: Person };

export const GO: { key: string; label: string; href: string }[] = [
  { key: "d", label: "Due", href: "/" },
  { key: "i", label: "Inbox", href: "/inbox" },
  { key: "r", label: "Recap", href: "/recap" },
  { key: "p", label: "People", href: "/people" },
  { key: "t", label: "Table", href: "/table" },
  { key: "s", label: "Settings", href: "/settings" },
];

const ACTIONS: Item[] = [
  ...GO.map((g) => ({ kind: "go" as const, label: `Go to ${g.label}`, href: g.href, hint: `G ${g.key.toUpperCase()}` })),
  { kind: "go", label: "Add a person", href: "/contacts/new", hint: "N" },
  { kind: "go", label: "Import contacts or LinkedIn", href: "/import" },
  { kind: "go", label: "Send feedback", href: "#feedback", hint: "F" },
];

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function openPalette() {
  window.dispatchEvent(new CustomEvent("cadence:palette"));
}

export default function Shortcuts() {
  const router = useRouter();
  const path = usePathname();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [gPending, setGPending] = useState(false);
  const gTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Prefetch every tab once so keyboard jumps are instant.
  useEffect(() => { GO.forEach((g) => router.prefetch(g.href)); }, [router]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setHelp(false); setPalette((p) => !p); return; }
    if (e.key === "Escape") { setPalette(false); setHelp(false); return; }
    if (palette || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const k = e.key.toLowerCase();

    if (gPending) {
      const g = GO.find((x) => x.key === k);
      setGPending(false);
      clearTimeout(gTimer.current);
      if (g) { e.preventDefault(); router.push(g.href); }
      return;
    }
    if (k === "g") { setGPending(true); clearTimeout(gTimer.current); gTimer.current = setTimeout(() => setGPending(false), 1200); return; }
    if (k === "n") { e.preventDefault(); router.push("/contacts/new"); return; }
    if (e.key === "?") { e.preventDefault(); setHelp((h) => !h); return; }
    if (k === "/") {
      e.preventDefault();
      const search = document.getElementById("people-search") as HTMLInputElement | null;
      if (search) { search.focus(); search.select(); } else setPalette(true);
    }
  }, [gPending, palette, router]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    const open = () => setPalette(true);
    window.addEventListener("cadence:palette", open);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("cadence:palette", open); };
  }, [onKey]);

  useEffect(() => { setPalette(false); setHelp(false); }, [path]);

  return (
    <>
      {gPending && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg sm:bottom-6">
          Go to… <span className="opacity-70">D Due · I Inbox · R Recap · P People · T Table · S Settings</span>
        </div>
      )}
      {palette && <Palette onClose={() => setPalette(false)} />}
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { paletteIndex().then(setPeople).catch(() => setPeople([])); }, []);

  const items = useMemo<Item[]>(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (s: string) => terms.every((t) => s.toLowerCase().includes(t));
    const acts = ACTIONS.filter((a) => !terms.length || match(a.label));
    const ppl = (people ?? [])
      .filter((p) => terms.length && match(`${p.name} ${p.sub}`))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(terms[0] ?? "")) - Number(a.name.toLowerCase().startsWith(terms[0] ?? "")) || Number(b.sorted) - Number(a.sorted))
      .slice(0, 8)
      .map((p) => ({ kind: "person" as const, label: p.name, sub: p.sub, href: `/contacts/${p.id}`, person: p }));
    return terms.length ? [...ppl, ...acts] : acts;
  }, [q, people]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const go = (it?: Item) => {
    if (!it) return;
    onClose();
    if (it.href === "#feedback") window.dispatchEvent(new CustomEvent("cadence:feedback"));
    else router.push(it.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Command palette" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") { e.preventDefault(); go(items[sel]); }
          }}
          placeholder="Search people or jump to…"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-base outline-none"
        />
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{people === null ? "Loading people…" : "No matches"}</p>}
          {items.map((it, i) => (
            <button
              key={it.href + it.label}
              data-i={i}
              onMouseMove={() => setSel(i)}
              onClick={() => go(it)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${i === sel ? "bg-paper" : ""}`}
            >
              {it.person ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold text-white" style={{ background: it.person.type ? TYPE_META[it.person.type].hex : "rgb(var(--muted))" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.person.photo ? <img src={it.person.photo} alt="" className="h-full w-full object-cover" /> : it.label.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper text-muted">→</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.label}</span>
                {it.sub && <span className="block truncate text-xs text-muted">{it.sub}{it.person && !it.person.sorted ? " · in inbox" : ""}</span>}
              </span>
              {it.hint && <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">{it.hint}</kbd>}
            </button>
          ))}
        </div>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>↑↓ to move</span><span>↵ to open</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["⌘ K", "Search people and commands"],
    ["G then D", "Due"], ["G then I", "Inbox"], ["G then R", "Recap"], ["G then P", "People"], ["G then T", "Table"], ["G then S", "Settings"],
    ["N", "Add a person"], ["/", "Search (People page) or open palette"],
    ["Space", "Peek at the hovered person (People page)"], ["← →", "Previous / next person while peeking"],
    ["⌘ V", "Paste a photo (hover an avatar, or anywhere on a profile)"],
    ["F", "Send feedback"],
    ["?", "Show this list"], ["Esc", "Close"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Keyboard shortcuts" className="w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-display text-xl font-semibold">Keyboard shortcuts</h2>
        <dl className="space-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4">
              <dd className="text-muted">{v}</dd>
              <dt><kbd className="rounded border border-line bg-paper px-1.5 py-0.5 text-xs">{k}</kbd></dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
