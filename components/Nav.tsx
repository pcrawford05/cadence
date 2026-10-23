"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { openPalette } from "./Shortcuts";
import { openFeedback } from "./Feedback";
import { useRouter } from "next/navigation";
import { scanStore } from "@/lib/scanStore";

const items = [
  { href: "/", label: "Due", icon: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/inbox", label: "Inbox", icon: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" },
  { href: "/recap", label: "Recap", icon: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" },
  { href: "/people", label: "People", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74" },
  { href: "/table", label: "Table", icon: "M3 5h18M3 12h18M3 19h18M9 5v14" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Slides a highlight under whichever link is active. */
function useIndicator(path: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const measure = () => {
    const el = ref.current?.querySelector<HTMLElement>("[data-active=true]");
    setBox(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  };
  useLayoutEffect(measure, [path]);
  useEffect(() => { addEventListener("resize", measure); return () => removeEventListener("resize", measure); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, box, measure };
}

export default function Nav() {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const top = useIndicator(path);
  const bottom = useIndicator(path);
  const router = useRouter();
  const [mini, setMini] = useState(false);
  const [drag, setDrag] = useState<number | null>(null); // index under the finger while swiping the tab bar

  // Start the day's recap as soon as the app opens, so Recap is ready when you get there.
  useEffect(() => { if (path === "/login") return; scanStore.count(); if (scanStore.due()) scanStore.run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (path !== "/login") scanStore.count(); }, [path]);
  const recap = useSyncExternalStore(scanStore.subscribe, scanStore.get, scanStore.get);
  const badge = (href: string) => href === "/recap" && recap.pending > 0
    ? <span aria-label={`${recap.pending} to review`} className="badge-pop absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm">{recap.pending > 9 ? "9+" : recap.pending}</span>
    : null;

  const tabAt = (x: number) => {
    const links = [...(bottom.ref.current?.querySelectorAll<HTMLElement>("a[data-tab]") ?? [])];
    let best = 0, dist = Infinity;
    links.forEach((el, i) => { const r = el.getBoundingClientRect(); const d = Math.abs(x - (r.left + r.width / 2)); if (d < dist) { dist = d; best = i; } });
    return best;
  };
  const dragBox = (() => {
    if (drag == null) return null;
    const el = bottom.ref.current?.querySelectorAll<HTMLElement>("a[data-tab]")[drag];
    return el ? { left: el.offsetLeft, width: el.offsetWidth } : null;
  })();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      setScrolled(y > 8);
      if (Math.abs(y - last) > 6) { setMini(y > last && y > 80); last = y; }
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setMini(false); }, [path]);
  // Labels change width when the pill shrinks; re-measure after it settles.
  useEffect(() => { const t = setTimeout(bottom.measure, 320); return () => clearTimeout(t); }, [mini]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <header className="sticky top-0 z-30 hidden px-6 pt-3 sm:block">
        <div className={`glass relative mx-auto flex max-w-6xl items-center gap-6 rounded-full py-1.5 pl-5 pr-1.5 transition-shadow ${scrolled ? "scroll-edge" : ""}`}>
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">Cadence</Link>
          <nav ref={top.ref} className="relative flex gap-0.5">
            {top.box && <span aria-hidden className="tab-active-dot absolute inset-y-0 rounded-full bg-ink" style={{ left: top.box.left, width: top.box.width }} />}
            {items.map((i) => (
              <Link key={i.href} href={i.href} data-active={active(i.href)} aria-current={active(i.href) ? "page" : undefined}
                className={`relative rounded-full px-3 py-1.5 text-sm transition-colors duration-300 ${active(i.href) ? "text-paper" : "text-muted hover:text-ink"}`}>
                {i.label}
                {badge(i.href)}
              </Link>
            ))}
          </nav>
          <button onClick={openFeedback} className="ml-auto text-sm text-muted hover:text-ink" title="Send feedback (F)">Feedback</button>
          <button onClick={openPalette} className="glass-thin flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted hover:text-ink" title="Search (Cmd+K)">
            Search <kbd className="rounded border border-line px-1 text-[11px]">⌘K</kbd>
          </button>
          <Link href="/contacts/new" className="btn-primary py-2">+ Add person</Link>
        </div>
      </header>

      <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] sm:hidden">
        <div
          ref={bottom.ref}
          data-mini={mini && drag == null}
          className="tabbar glass pointer-events-auto relative flex touch-none select-none rounded-full p-1"
          style={{ transformOrigin: "50% 100%", transform: drag != null ? "scale(1.04)" : undefined }}
          onPointerDown={(e) => { setMini(false); setDrag(tabAt(e.clientX)); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag != null) { const i = tabAt(e.clientX); if (i !== drag) { setDrag(i); navigator.vibrate?.(5); } } }}
          onPointerUp={() => { if (drag != null) { const href = items[drag].href; setDrag(null); if (!active(href)) router.push(href); } }}
          onPointerCancel={() => setDrag(null)}
          onClick={(e) => { if (e.detail) e.preventDefault(); }}
        >
          {(dragBox ?? bottom.box) && <span aria-hidden className={`tab-active-dot absolute inset-y-1 rounded-full ${drag != null ? "bg-ink/[.14] dark:bg-white/20" : "bg-ink/[.08] dark:bg-white/10"}`} style={{ left: (dragBox ?? bottom.box)!.left, width: (dragBox ?? bottom.box)!.width }} />}
          {items.map((i) => (
            <Link key={i.href} href={i.href} data-tab data-active={active(i.href)} aria-current={active(i.href) ? "page" : undefined} draggable={false}
              className={`relative flex w-[54px] flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition-colors ${(drag != null ? drag === items.indexOf(i) : active(i.href)) ? "text-accent" : "text-ink/70"}`}>
              <span className="relative"><Icon d={i.icon} />{badge(i.href)}</span>
              <span className="tab-label overflow-hidden">{i.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
