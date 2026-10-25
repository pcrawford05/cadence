"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { scanStore } from "@/lib/scanStore";
import { refreshBadge } from "@/lib/badgeStore";
import { useRouter } from "next/navigation";
import { approveAll, approveProposal, dismissProposal, recapFromText } from "@/app/actions";
import { Avatar } from "./ui";
import type { ContactType } from "@/lib/types";

export type RecapItem = {
  id: string;
  status: "pending" | "approved" | "dismissed";
  date: string;
  kind: "email" | "meeting" | "manual" | "call";
  source: "gmail" | "calendar" | "manual";
  summary: string;
  evidence: string | null;
  confidence: number;
  person:
    | { kind: "existing"; id: string; name: string; sub: string; photo: string | null; type: ContactType | null }
    | { kind: "new"; name: string; email: string | null; company: string; position: string; notes: string | null };
};

const KIND_LABEL = { meeting: "Met", call: "Call", email: "Email", manual: "Message" } as const;
const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} d ago`;
};

export default function RecapClient({ items, googleConnected, ai }: { items: RecapItem[]; googleConnected: boolean; ai: boolean; lastSync?: string | null }) {
  const router = useRouter();
  const st = useSyncExternalStore(scanStore.subscribe, scanStore.get, scanStore.server);
  const scan = st.phase;
  const scanMsg = st.msg;
  const checkedAt = st.at;
  const busy = scan === "sync" || scan === "draft";
  const [text, setText] = useState("");
  const [textErr, setTextErr] = useState("");
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string[]>([]);
  const notify = (m: string) => { setFlash((f) => [...f.slice(-2), m]); setTimeout(() => setFlash((f) => f.slice(1)), 4000); };
  const runScan = () => scanStore.run(true);

  // Shell starts the daily scan; here we just kick it if it somehow hasn't, and refresh when one lands.
  useEffect(() => {
    if (googleConnected && scanStore.due()) scanStore.run();
    const on = () => router.refresh();
    addEventListener("cadence:recap-updated", on);
    return () => removeEventListener("cadence:recap-updated", on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingItems = items.filter((i) => i.status === "pending");
  useEffect(() => { refreshBadge(); }, [pendingItems.length]);
  const done = items.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {googleConnected ? (
          <>
            <div aria-live="polite" className="glass-thin flex max-w-full items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-3 pr-1.5">
              {busy ? (
                <>
                  <span className="relative flex h-2.5 w-2.5"><span className="absolute inset-0 animate-ping rounded-full bg-accent/50" /><span className="relative h-2.5 w-2.5 rounded-full bg-accent" /></span>
                  <span className="text-ink">{scan === "sync" ? "Checking calendar and email" : ai ? "Summarizing with Gemini" : "Matching people"}</span>
                  <span className="text-muted">{scan === "sync" ? "1 of 2" : "2 of 2"}</span>
                </>
              ) : (
                <span className={scan === "error" ? "text-red-600" : "text-muted"}>
                  {scan === "error" ? scanMsg : scan === "done" ? `${scanMsg} · ${checkedAt ? ago(checkedAt) : "just now"}` : checkedAt ? `Checked ${ago(checkedAt)}` : "Not checked yet"}
                </span>
              )}
              <button onClick={runScan} disabled={busy} className="btn-ghost py-1 text-xs">{busy ? "Working" : scan === "error" ? "Try again" : "Check now"}</button>
            </div>
            {busy && <span className="text-xs text-muted">Keep working; this runs in the background.</span>}
          </>
        ) : (
          <p className="text-muted">Connect Google in <Link href="/settings" className="underline">Settings</Link> to pull meetings from your calendar and email.</p>
        )}
        {!ai && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700">AI off: showing simple matches. Add a Gemini key for summaries.</span>}
      </div>

      {flash.length > 0 && (
        <div aria-live="polite" className="space-y-1">
          {flash.map((m, i) => <p key={i} className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{m}</p>)}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">To log {pendingItems.length ? `(${pendingItems.length})` : ""}</h2>
          {pendingItems.length > 1 && (
            <button
              disabled={pending}
              onClick={() => start(async () => { const n = await approveAll(pendingItems.map((i) => i.id)); notify(`✓ Logged ${n} conversations`); router.refresh(); })}
              className="btn-primary"
            >
              Log all {pendingItems.length}
            </button>
          )}
        </div>
        {pendingItems.length === 0 && busy ? (
          <div className="space-y-3" aria-hidden>{[0, 1].map((k) => <div key={k} className="h-36 animate-pulse rounded-3xl border border-line bg-card" />)}</div>
        ) : pendingItems.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {busy ? "Looking for conversations. New ones appear here." : "Nothing to review. Add anyone you talked to below."}
          </p>
        ) : (
          <div className="space-y-3">{pendingItems.map((i) => <Card key={i.id} item={i} onDone={notify} />)}</div>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-display text-xl font-semibold">Anyone else?</h2>
        <p className="mt-0.5 text-sm text-muted">Texts, LinkedIn, Discord, in person. Write it however you'd say it; new people are added for you.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Grabbed coffee with Jordan Lee from Ramp yesterday about PM internships. Texted Mia about the hackathon. Met Alex Kim at the USC mixer, she's a founder in LA."
          className="input mt-3"
        />
        {textErr && <p className="mt-2 text-sm text-red-600">{textErr}</p>}
        <div className="mt-3 flex justify-end">
          <button
            disabled={pending || !text.trim()}
            onClick={() => start(async () => {
              setTextErr("");
              const r = await recapFromText(text);
              if (!r.ok) return setTextErr(r.error ?? "Couldn't read that.");
              setText(""); router.refresh();
            })}
            className="btn-primary"
          >
            {pending ? "Reading…" : "Add to recap"}
          </button>
        </div>
      </section>

      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Handled recently ({done.length})</summary>
          <ul className="mt-3 space-y-1.5">
            {done.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-muted">
                <span className={i.status === "approved" ? "text-accent" : ""}>{i.status === "approved" ? "✓ Logged" : "Dismissed"}</span>
                <span className="text-ink">{i.person.name}</span> · {fmt(i.date)} · {i.summary}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Card({ item, onDone }: { item: RecapItem; onDone: (m: string) => void }) {
  const router = useRouter();
  const [summary, setSummary] = useState(item.summary);
  const [date, setDate] = useState(item.date);
  const [name, setName] = useState(item.person.name);
  const [company, setCompany] = useState(item.person.kind === "new" ? item.person.company : "");
  const [gone, setGone] = useState<"" | "logged" | "dismissed">("");
  const [pending, start] = useTransition();
  const p = item.person;
  const low = item.confidence < 0.45;

  if (gone) return <div className="rounded-3xl border border-line bg-card px-5 py-3 text-sm text-muted">{gone === "logged" ? `✓ Logged ${name}` : `Dismissed ${name}`}</div>;

  return (
    <article className={`card-in rounded-3xl border bg-card p-4 sm:p-5 ${low ? "border-dashed border-line" : "border-line"}`}>
      <div className="flex items-start gap-4">
        {p.kind === "existing" ? (
          <Link href={`/contacts/${p.id}`}><Avatar c={{ name: p.name, photo_url: p.photo, type: p.type }} size={56} /></Link>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent/50 font-display text-lg text-accent">
            {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {p.kind === "existing" ? (
              <Link href={`/contacts/${p.id}`} className="text-lg font-semibold hover:underline">{p.name}</Link>
            ) : (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 max-w-full flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold outline-none hover:border-line focus:border-accent" aria-label="Name" />
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">New to Cadence</span>
              </>
            )}
            {low && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">Not sure</span>}
          </div>
          {p.kind === "existing" ? (
            p.sub && <p className="text-sm text-muted">{p.sub}</p>
          ) : (
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" className="mt-1 w-full max-w-xs rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-sm text-muted outline-none hover:border-line focus:border-accent" aria-label="Company" />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-paper px-2 py-0.5 font-medium text-ink">{KIND_LABEL[item.kind]}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-transparent bg-transparent px-1 py-0.5 hover:border-line focus:border-accent focus:outline-none" aria-label="Date" />
            {item.evidence && <span className="truncate">· {item.evidence}</span>}
          </div>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={1} aria-label="What you talked about"
            className="mt-2 min-h-[2.5rem] w-full resize-none rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none [field-sizing:content] focus:border-accent" />
          {p.kind === "new" && p.notes && <p className="mt-1 text-xs text-muted">Context saved to their notes: {p.notes}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
        <button disabled={pending} onClick={() => start(async () => { await dismissProposal(item.id); setGone("dismissed"); onDone(`Dismissed ${name}`); router.refresh(); })} className="btn-ghost">Dismiss</button>
        <button
          disabled={pending}
          onClick={() => start(async () => {
            await approveProposal(item.id, { summary, date, ...(p.kind === "new" ? { name, company } : {}) });
            setGone("logged");
            onDone(p.kind === "new" ? `✓ Added ${name} and logged the conversation` : `✓ Logged ${name}`);
            router.refresh();
          })}
          className="btn-primary"
        >
          {p.kind === "new" ? "Add & log" : "Log it"}
        </button>
      </div>
    </article>
  );
}
