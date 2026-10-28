import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repo } from "./repo";
import { draftsFromSignals, draftsFromText, type Draft, type SignalInput } from "./ai";
import type { ContactType, InteractionKind } from "./types";

export interface Signal extends SignalInput { id: string; external_id: string; processed: boolean }

export interface Proposal {
  id: string;
  contact_id: string | null;
  new_contact: Draft["newPerson"];
  occurred_at: string;
  kind: InteractionKind;
  source: "gmail" | "calendar" | "manual";
  summary: string | null;
  evidence: string | null;
  confidence: number | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  decided_at: string | null;
}

export interface RecapStore {
  pendingSignals(days: number): Promise<Signal[]>;
  markProcessed(ids: string[]): Promise<void>;
  addSignals(rows: Omit<Signal, "id" | "processed">[]): Promise<void>;
  insertProposals(rows: Omit<Proposal, "id" | "status" | "created_at" | "decided_at">[]): Promise<void>;
  listProposals(): Promise<Proposal[]>; // pending + decided in last 3 days
  getProposal(id: string): Promise<Proposal | null>;
  decide(id: string, status: "approved" | "dismissed"): Promise<void>;
}

/* ---------------- Supabase ---------------- */
export class SupabaseRecap implements RecapStore {
  constructor(private db: SupabaseClient, private userId: string) {}
  async pendingSignals(days: number) {
    const { data, error } = await this.db.from("signals").select("*").eq("user_id", this.userId).eq("processed", false)
      .gte("occurred_at", new Date(Date.now() - days * 86_400_000).toISOString()).order("occurred_at");
    if (error) throw error;
    return data as Signal[];
  }
  async markProcessed(ids: string[]) {
    if (ids.length) await this.db.from("signals").update({ processed: true }).eq("user_id", this.userId).in("id", ids);
  }
  async addSignals(rows: Omit<Signal, "id" | "processed">[]) {
    if (rows.length) await this.db.from("signals").upsert(rows.map((r) => ({ ...r, user_id: this.userId })), { onConflict: "user_id,source,external_id", ignoreDuplicates: true });
  }
  async insertProposals(rows: Omit<Proposal, "id" | "status" | "created_at" | "decided_at">[]) {
    if (!rows.length) return;
    const { error } = await this.db.from("proposals").insert(rows.map((r) => ({ ...r, user_id: this.userId })));
    if (error) throw error;
  }
  async listProposals() {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const { data, error } = await this.db.from("proposals").select("*").eq("user_id", this.userId)
      .or(`status.eq.pending,decided_at.gte.${since}`).order("occurred_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data as Proposal[];
  }
  async getProposal(id: string) {
    const { data } = await this.db.from("proposals").select("*").eq("user_id", this.userId).eq("id", id).maybeSingle();
    return (data as Proposal) ?? null;
  }
  async decide(id: string, status: "approved" | "dismissed") {
    await this.db.from("proposals").update({ status, decided_at: new Date().toISOString() }).eq("user_id", this.userId).eq("id", id);
  }
}

/* ---------------- Demo (in memory) ---------------- */
type DemoState = { signals: Signal[]; proposals: Proposal[] };
const g = globalThis as unknown as { __recapDemo?: DemoState };
const H = (h: number) => new Date(Date.now() - h * 3.6e6).toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

function demo(): DemoState {
  return (g.__recapDemo ??= {
    proposals: [],
    signals: [
      { id: "s1", source: "calendar", external_id: "e1", occurred_at: H(20), title: "Coffee w/ Maya", detail: "Blue Bottle, Mint Plaza · Talk seed round + intro to their lead", participants: [{ email: "maya@example.com", name: "Maya Okafor" }], processed: false },
      { id: "s2", source: "gmail", external_id: "t2", occurred_at: H(30), title: "Re: Intro to Northwind portfolio founders", detail: "4 message thread", participants: [{ email: "priya@example.com", name: "Priya Natarajan" }], processed: false },
      { id: "s3", source: "calendar", external_id: "e3", occurred_at: H(50), title: "Chat: Sarah Lin (Stripe)", detail: "Zoom · Career chat about payments PM roles", participants: [{ email: "sarah.lin@stripe.com", name: "Sarah Lin" }], processed: false },
      { id: "s4", source: "calendar", external_id: "e4", occurred_at: H(26), title: "Lunch with Theo", detail: null, participants: [], processed: false },
    ],
  });
}

export class DemoRecap implements RecapStore {
  async pendingSignals() { return demo().signals.filter((s) => !s.processed); }
  async markProcessed(ids: string[]) { demo().signals.forEach((s) => ids.includes(s.id) && (s.processed = true)); }
  async addSignals() {}
  async insertProposals(rows: Omit<Proposal, "id" | "status" | "created_at" | "decided_at">[]) {
    demo().proposals.push(...rows.map((r) => ({ ...r, id: uid(), status: "pending" as const, created_at: new Date().toISOString(), decided_at: null })));
  }
  async listProposals() { return [...demo().proposals].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)); }
  async getProposal(id: string) { return demo().proposals.find((p) => p.id === id) ?? null; }
  async decide(id: string, status: "approved" | "dismissed") {
    const p = demo().proposals.find((x) => x.id === id);
    if (p) { p.status = status; p.decided_at = new Date().toISOString(); }
  }
}

/* ---------------- Workflows ---------------- */

const noonLocal = (date: string) => `${date}T19:00:00Z`; // ~noon Pacific; date is what matters

/** Most signals one scan request drafts; the rest wait for the next request (`more`). */
const PER_RUN = 24;

/** Turn unreviewed Gmail/Calendar signals into proposals. Returns how many were added and whether more are waiting. */
export async function generateFromSignals(store: RecapStore, repo: Repo, tz: string): Promise<{ added: number; more: boolean }> {
  const all = await store.pendingSignals(14);
  if (!all.length) return { added: 0, more: false };
  const signals = all.slice(0, PER_RUN);
  const contacts = await repo.listContactsBare();
  const drafts = await draftsFromSignals(signals, contacts, tz);
  await store.insertProposals(drafts.map((d) => {
    const s = d.signalIndex != null ? signals[d.signalIndex] : null;
    return {
      contact_id: d.contactId, new_contact: d.newPerson, occurred_at: s?.occurred_at ?? noonLocal(d.date), kind: d.kind,
      source: s?.source ?? "manual", summary: d.summary, confidence: d.confidence,
      evidence: s ? `${s.source === "calendar" ? "Calendar" : "Email"}: ${s.title ?? "(untitled)"}` : null,
    };
  }));
  await store.markProcessed(signals.map((s) => s.id));
  return { added: drafts.length, more: all.length > signals.length };
}

/** "Anyone else?" box. */
export async function generateFromText(store: RecapStore, repo: Repo, text: string, tz: string): Promise<number> {
  const drafts = await draftsFromText(text, await repo.listContactsBare(), tz);
  await store.insertProposals(drafts.map((d) => ({
    contact_id: d.contactId, new_contact: d.newPerson, occurred_at: noonLocal(d.date), kind: d.kind, source: "manual",
    summary: d.summary, confidence: d.confidence, evidence: "You told the recap",
  })));
  return drafts.length;
}

export interface ApproveEdits { summary?: string; date?: string; name?: string; company?: string; position?: string }

/** Log it: creates the person if new (Inbox unless you gave a cadence), then records the conversation. */
export async function approve(store: RecapStore, repo: Repo, id: string, edits: ApproveEdits = {}): Promise<{ contactId: string; created: boolean }> {
  const p = await store.getProposal(id);
  if (!p || p.status !== "pending") throw new Error("Already handled");
  let contactId = p.contact_id;
  let created = false;
  if (!contactId) {
    const n = p.new_contact!;
    const type: ContactType = n.type ?? "purple";
    const date = (edits.date || p.occurred_at.slice(0, 10));
    const c = await repo.createContact({
      name: (edits.name || n.name).trim(),
      emails: n.email ? [n.email] : [],
      company: edits.company ?? n.company ?? null,
      position: edits.position ?? n.position ?? null,
      location: n.location ?? null,
      notes: n.notes ?? null,
      type,
      statuses: ["new"],
      date_met: date,
      source: "ai",
      // Fully described people skip the Inbox; otherwise they wait there to be finished.
      triaged_at: n.type || (n.company && (n.notes || n.position)) ? new Date().toISOString() : null,
    });
    contactId = c.id;
    created = true;
  }
  const date = edits.date && /^\d{4}-\d{2}-\d{2}$/.test(edits.date) ? edits.date : null;
  await repo.logInteraction({
    contact_id: contactId,
    occurred_at: date ? noonLocal(date) : p.occurred_at,
    kind: p.kind,
    source: p.source === "calendar" ? "calendar" : p.source === "gmail" ? "gmail" : "manual",
    summary: (edits.summary ?? p.summary ?? "Talked").slice(0, 300),
    external_id: `proposal:${p.id}`,
  });
  await repo.updateContact(contactId, { snoozed_until: null });
  await store.decide(id, "approved");
  return { contactId, created };
}
