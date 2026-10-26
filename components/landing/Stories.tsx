"use client";
import { useRef } from "react";
import { Avatar } from "@/components/ui";
import { TYPES, TYPE_META, type ContactType } from "@/lib/types";
import { useStory } from "./Motion";

/** Fictional people for the landing visuals. Photos are the demo-mode illustrations. */
const PEOPLE: { name: string; role: string; type: ContactType; due: string; over: boolean; last: string; photo: string }[] = [
  { name: "Maya Chen", role: "Partner at Fieldstone Ventures", type: "red", due: "3 days overdue", over: true, last: "Talked 17d ago", photo: "/demo/p3.svg" },
  { name: "Jordan Ellis", role: "Recruiter at Brightline", type: "orange", due: "Due today", over: false, last: "Talked 1mo ago", photo: "/demo/p5.svg" },
  { name: "Priya Raman", role: "Founder of Kestrel Bio", type: "yellow", due: "6 days overdue", over: true, last: "Talked 3mo ago", photo: "/demo/p8.svg" },
  { name: "Marcus Webb", role: "Engineering lead at Harbor", type: "orange", due: "Due today", over: false, last: "Talked 1mo ago", photo: "/demo/p2.svg" },
  { name: "Sofia Alvarez", role: "Professor at USC Marshall", type: "green", due: "11 days overdue", over: true, last: "Talked 6mo ago", photo: "/demo/p11.svg" },
];

const ROW = 104; // card height plus gap, in px

/**
 * Hero: the Due list working. The top person gets logged, folds away, the rest step up and the
 * next one arrives at the bottom. Under Reduce Motion it is the list at rest.
 */
export function DueDeck() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStory(ref, 1500);
  const i = Math.floor(step / 2);
  const logged = step % 2 === 1;
  return (
    <div ref={ref} className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-paper/80 p-4 shadow-2xl shadow-black/10 sm:p-5">
      <div className="mb-4 flex items-end justify-between px-1">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Today</p>
          <p className="font-display text-2xl font-semibold tracking-tight">3 to reach out to</p>
        </div>
        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">3</span>
      </div>
      <div className="relative overflow-hidden" style={{ height: ROW * 3 - 8 }} aria-label="Example list of people due today">
        {[-1, 0, 1, 2, 3].map((slot) => {
          const k = i + slot;
          const p = PEOPLE[((k % PEOPLE.length) + PEOPLE.length) % PEOPLE.length];
          const hidden = slot < 0 || slot > 2;
          return (
            <article
              key={k}
              aria-hidden={hidden}
              className="deck-card absolute inset-x-0 top-0 rounded-3xl border border-line bg-card p-3.5"
              style={{
                transform: `translateY(${slot < 0 ? -24 : slot * ROW}px) scale(${slot < 0 ? 0.96 : 1})`,
                opacity: hidden ? 0 : 1,
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar c={{ name: p.name, photo_url: p.photo, type: p.type }} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold leading-tight">{p.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${p.over ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-accent/10 text-accent"}`}>{p.due}</span>
                  </div>
                  <p className="truncate text-sm text-muted">{p.role}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{p.last} · {TYPE_META[p.type].blurb}</p>
                </div>
              </div>
              {slot === 0 && (
                <div className={`absolute inset-0 flex items-center justify-center gap-2 rounded-3xl bg-card font-semibold text-accent transition-opacity duration-300 ${logged ? "opacity-100" : "opacity-0"}`}>
                  <Check /> Logged. Next one {NEXT[p.type]}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

const NEXT: Record<ContactType, string> = {
  red: "in 14 days", orange: "in 30 days", yellow: "in 90 days", green: "in 6 months", blue: "in a year", purple: "when it's relevant",
};

/** Step 1: one person tries on each rhythm, and the next check in follows. */
export function Rhythm() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStory(ref, 1600);
  const t = TYPES[step % TYPES.length];
  return (
    <div ref={ref} className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="transition-transform duration-300" key={t}><Avatar c={{ name: "Maya Chen", photo_url: "/demo/p3.svg", type: t }} size={64} /></div>
        <div>
          <p className="font-semibold">Maya Chen</p>
          <p className="text-sm text-muted">Next check in <span className="font-medium text-ink">{NEXT[t]}</span></p>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-1.5">
        {TYPES.map((x) => (
          <span key={x} className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors duration-300 ${x === t ? "border-ink/30 bg-ink/5 text-ink" : "border-line text-muted"}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_META[x].hex }} />
            {TYPE_META[x].blurb}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Step 2: the morning push lands and the app icon picks up its badge. */
export function Morning() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStory(ref, 1400, 2);
  const shown = step % 4 !== 0;
  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-4 text-white">
      <p className="text-center text-4xl font-semibold tracking-tight text-white/90">8:00</p>
      <p className="mb-4 text-center text-xs text-white/60">Monday, October 27</p>
      <div className={`notif rounded-2xl bg-white/15 p-3 backdrop-blur-md ${shown ? "is-in" : ""}`}>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Mark className="h-5 w-5 rounded-md bg-zinc-900 p-0.5" />
          <span className="font-semibold uppercase tracking-wide">Cadence</span>
          <span className="ml-auto">now</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold">3 people today</p>
        <p className="text-sm text-white/80">Maya, Jordan and Priya are due. Tap to see them.</p>
      </div>
      <div className="mt-4 flex justify-center">
        <div className="relative">
          <Mark className="h-12 w-12 rounded-xl bg-zinc-800 p-1.5" />
          <span className={`badge-dot absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold ${shown ? "is-in" : ""}`}>3</span>
        </div>
      </div>
    </div>
  );
}

/** Step 3: a calendar event becomes a proposal, gets approved, and the log updates itself. */
export function Recap() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useStory(ref, 1300, 3) % 5;
  return (
    <div ref={ref} className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2.5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Coffee with Jordan Ellis</p>
          <p className="text-xs text-muted">Calendar · Tue 10:00 AM</p>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-card p-3">
        {phase === 0 ? (
          <div className="flex items-center gap-2.5 py-1" aria-hidden>
            <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-line" />
            <div className="flex-1 space-y-1.5">
              <span className="block h-3 w-3/4 animate-pulse rounded-full bg-line" />
              <span className="block h-3 w-1/2 animate-pulse rounded-full bg-line" />
            </div>
          </div>
        ) : phase < 3 ? (
          <div className="recap-card is-in">
            <div className="flex items-center gap-2.5">
              <Avatar c={{ name: "Jordan Ellis", photo_url: "/demo/p5.svg", type: "orange" }} size={36} />
              <p className="text-sm">Log a coffee chat with <span className="font-semibold">Jordan Ellis</span>?</p>
            </div>
            <div className="mt-3 flex gap-2">
              <span className={`btn-primary pointer-events-none ${phase === 2 ? "scale-95 ring-4 ring-accent/30" : ""}`}>Approve</span>
              <span className="btn-ghost pointer-events-none">Dismiss</span>
            </div>
          </div>
        ) : (
          <p className="recap-card is-in flex items-center gap-2 py-1.5 text-sm font-semibold text-accent">
            <Check /> Logged. Jordan is next due Nov 27.
          </p>
        )}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** The app icon's four arcs, at rest. Matches the launch screen. */
export function Mark({ className = "" }: { className?: string }) {
  const rings = [
    { r: 46, c: "#E5484D", d: 0 },
    { r: 36, c: "#E2A336", d: 90 },
    { r: 26, c: "#30A46C", d: 180 },
    { r: 16, c: "#0090FF", d: 270 },
  ];
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      {rings.map((g) => (
        <circle key={g.r} cx="60" cy="60" r={g.r} pathLength={100} fill="none" stroke={g.c} strokeWidth={9} strokeLinecap="round"
          strokeDasharray="22 100" transform={`rotate(${g.d - 90} 60 60)`} />
      ))}
      <circle cx="60" cy="60" r="6" fill="currentColor" />
    </svg>
  );
}
