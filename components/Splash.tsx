"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TABS = ["/", "/inbox", "/recap", "/people", "/table", "/settings"];

/**
 * Launch screen (cold open only). The rings draw in while we warm the photo cache and prefetch
 * every tab; it lifts when photos are in (or after 3s), never before the animation completes.
 * Visibility is decided by an inline script before first paint, so there is no flash either way.
 */
export default function Splash() {
  const router = useRouter();
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-splash")) return;
    const started = performance.now();
    TABS.forEach((t) => router.prefetch(t));

    const photos = fetch("/api/preload").then((r) => r.json()).then(({ urls }: { urls: string[] }) =>
      Promise.all(urls.map((u) => new Promise<void>((ok) => { const i = new Image(); i.decoding = "async"; i.onload = i.onerror = () => ok(); i.src = u; }))),
    ).catch(() => {});
    const minAnim = new Promise((ok) => setTimeout(ok, 1350));
    const cap = new Promise((ok) => setTimeout(ok, 3000));

    Promise.race([Promise.all([photos, minAnim]), cap]).then(() => {
      root.setAttribute("data-splash", "out");
      setTimeout(() => root.removeAttribute("data-splash"), 520);
      try { sessionStorage.setItem("cadence.launched", String(Math.round(performance.now() - started))); } catch {}
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rings = [
    { r: 46, c: "#E5484D", d: 0 },
    { r: 36, c: "#E2A336", d: 90 },
    { r: 26, c: "#30A46C", d: 180 },
    { r: 16, c: "#0090FF", d: 270 },
  ];
  return (
    <div id="splash" aria-hidden>
      <svg viewBox="0 0 120 120" className="splash-mark">
        {rings.map((g, i) => (
          <circle key={i} className="splash-ring" cx="60" cy="60" r={g.r} pathLength={100} stroke={g.c}
            style={{ ["--i" as string]: i, ["--rot" as string]: `${g.d - 90}deg` }} />
        ))}
        <circle className="splash-dot" cx="60" cy="60" r="5" />
      </svg>
      <p className="splash-word">Cadence</p>
    </div>
  );
}
