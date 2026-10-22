import type { Contact, ContactType, InteractionKind } from "./types";
import { TYPES } from "./types";

/** One thing the AI thinks you should log. */
export interface Draft {
  signalIndex: number | null;
  contactId: string | null;
  newPerson: { name: string; email?: string | null; company?: string | null; position?: string | null; location?: string | null; notes?: string | null; type?: ContactType | null } | null;
  date: string; // YYYY-MM-DD
  kind: InteractionKind;
  summary: string;
  confidence: number;
}

export interface SignalInput {
  source: "gmail" | "calendar";
  occurred_at: string;
  title: string | null;
  detail: string | null;
  participants: { email: string | null; name: string | null }[];
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
let resolved: string | null = null;
let ranked: string[] = [];

/** Newest generally available Flash model this key can use (Google retires names often). */
async function pickModel(): Promise<string> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (resolved) return resolved;
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! } });
  if (!r.ok) throw new Error(`Gemini error ${r.status} listing models`);
  const { models = [] } = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const ver = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const ok = models
    .map((m) => ({ id: m.name.replace(/^models\//, ""), gen: m.supportedGenerationMethods ?? [] }))
    .filter((m) => m.gen.includes("generateContent") && /^gemini-[\d.]+-flash$|^gemini-[\d.]+-flash-latest$|^gemini-flash-latest$/.test(m.id))
    .sort((a, b) => ver(b.id) - ver(a.id));
  const fallback = models.map((m) => m.name.replace(/^models\//, "")).find((id) => /flash/.test(id) && !/lite|image|tts|live|audio|preview|exp/.test(id));
  const lite = models.map((m) => m.name.replace(/^models\//, "")).filter((id) => /^gemini-[\d.]+-flash-lite$/.test(id)).sort((a, b) => ver(b) - ver(a));
  ranked = [...new Set([...ok.map((m) => m.id), ...(fallback ? [fallback] : []), ...lite])];
  resolved = ranked[0] ?? "gemini-flash-latest";
  return resolved;
}
export const aiEnabled = () => !!process.env.GEMINI_API_KEY;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    entries: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          signal_index: { type: "INTEGER", nullable: true, description: "Index of the source item, or null for free-text" },
          contact_id: { type: "STRING", nullable: true, description: "id from the directory if this is an existing contact, else null" },
          new_person: {
            type: "OBJECT", nullable: true,
            properties: {
              name: { type: "STRING" }, email: { type: "STRING", nullable: true }, company: { type: "STRING", nullable: true },
              position: { type: "STRING", nullable: true }, location: { type: "STRING", nullable: true },
              notes: { type: "STRING", nullable: true, description: "How they met / context, in the user's words" },
              type: { type: "STRING", nullable: true, enum: [...TYPES], description: "Only if the user stated how often to keep in touch" },
            },
            required: ["name"],
          },
          date: { type: "STRING", description: "YYYY-MM-DD" },
          kind: { type: "STRING", enum: ["meeting", "call", "email", "manual"], description: "manual = text, DM, or other" },
          summary: { type: "STRING", description: "One short sentence on what was discussed. Grounded only in the input." },
          confidence: { type: "NUMBER", description: "0 to 1: how likely a real 1:1 conversation happened" },
        },
        required: ["date", "kind", "summary", "confidence"],
      },
    },
  },
  required: ["entries"],
};

const SYSTEM = `You help a student log networking conversations in a personal CRM.
Rules:
- Only propose real conversations with specific people. Skip newsletters, automated mail, receipts, mass events, class logistics, and anything with no identifiable person.
- One entry per person per day. A meeting with two people yields two entries.
- Match people to the directory by email first, then by clear name match. Use the directory id exactly. If unsure or not present, set contact_id null and fill new_person with only facts given in the input.
- Summaries: one sentence, past tense, about the topic. Use only the title/subject/description or the user's words. Never invent details. If the topic is unknown, write "Met" or "Emailed" plus the subject.
- Confidence: about 0.9 for a 1:1 calendar meeting or a named coffee/call; about 0.6 for an email thread; below 0.4 for ambiguous items.
- Dates are local dates (YYYY-MM-DD). For free text, resolve words like "yesterday" relative to Today.`;

async function callGemini(prompt: string, retried = false, attempt = 0): Promise<unknown[]> {
  const first = await pickModel();
  // On overload, wait briefly, then walk down to the next available Flash model.
  const model = attempt === 0 ? first : ranked[attempt - 1] ?? first;
  const legacy = /gemini-2\./.test(model); // 2.x takes a thinking budget; newer models choose their own
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2, ...(legacy ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    if ((r.status === 503 || r.status === 500) && attempt < Math.min(4, ranked.length + 1)) {
      await new Promise((ok) => setTimeout(ok, 1200));
      return callGemini(prompt, retried, attempt + 1);
    }
    if (r.status === 429) throw new Error("Gemini's free limit was hit. Try again in a minute.");
    if ((r.status === 404 || r.status === 400) && !retried && !process.env.GEMINI_MODEL) { resolved = null; return callGemini(prompt, true); }
    console.error(`[gemini] ${model} ${r.status}: ${body.slice(0, 500)}`);
    throw new Error(`Gemini (${model}) error ${r.status}: ${body.slice(0, 160)}`);
  }
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  try {
    return (JSON.parse(text).entries ?? []) as unknown[];
  } catch {
    throw new Error("Gemini returned something unreadable. Try again.");
  }
}

/** Compact directory so the model can match names without seeing everything. */
function directory(contacts: Contact[], focusEmails: Set<string>, freeText = "") {
  const words = new Set(freeText.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2));
  const relevant = contacts.filter((c) =>
    c.emails.some((e) => focusEmails.has(e.toLowerCase())) || c.name.toLowerCase().split(/\s+/).some((p) => words.has(p)),
  );
  const list = (relevant.length ? relevant : []).concat(contacts.filter((c) => !relevant.includes(c)).slice(0, Math.max(0, 400 - relevant.length)));
  return list.map((c) => `${c.id} | ${c.name} | ${c.emails.join(" ")} | ${[c.position, c.company].filter(Boolean).join(" at ")}`).join("\n");
}

/** Validate model output against real ids and sane values. */
function clean(raw: unknown[], contacts: Contact[], signalsCount: number, today: string): Draft[] {
  const ids = new Set(contacts.map((c) => c.id));
  const byEmail = new Map<string, string>();
  contacts.forEach((c) => c.emails.forEach((e) => byEmail.set(e.toLowerCase(), c.id)));
  const out: Draft[] = [];
  for (const x of raw as Record<string, any>[]) {
    if (!x || typeof x !== "object") continue;
    let contactId = typeof x.contact_id === "string" && ids.has(x.contact_id) ? x.contact_id : null;
    let np = x.new_person && typeof x.new_person.name === "string" && x.new_person.name.trim() ? x.new_person : null;
    if (!contactId && np?.email && byEmail.has(String(np.email).toLowerCase())) { contactId = byEmail.get(String(np.email).toLowerCase())!; np = null; }
    if (!contactId && !np) continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date <= today ? x.date : today;
    const idx = Number.isInteger(x.signal_index) && x.signal_index >= 0 && x.signal_index < signalsCount ? x.signal_index : null;
    out.push({
      signalIndex: idx,
      contactId,
      newPerson: contactId ? null : {
        name: String(np.name).trim().slice(0, 120),
        email: np.email ? String(np.email).toLowerCase().slice(0, 200) : null,
        company: np.company ?? null, position: np.position ?? null, location: np.location ?? null,
        notes: np.notes ?? null, type: (TYPES as readonly string[]).includes(np.type) ? np.type : null,
      },
      date,
      kind: ["meeting", "call", "email", "manual"].includes(x.kind) ? x.kind : "meeting",
      summary: String(x.summary ?? "").trim().slice(0, 300) || "Talked",
      confidence: Math.max(0, Math.min(1, Number(x.confidence) || 0.5)),
    });
  }
  // one entry per person per day
  const seen = new Set<string>();
  return out.filter((d) => {
    const k = `${d.contactId ?? d.newPerson?.email ?? d.newPerson?.name.toLowerCase()}|${d.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const localDay = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Gmail/Calendar evidence -> drafts. Uses Gemini when configured, else a simple rule-based pass. */
export async function draftsFromSignals(signals: SignalInput[], contacts: Contact[], tz: string): Promise<Draft[]> {
  if (!signals.length) return [];
  const today = localDay(new Date().toISOString(), tz);
  if (!aiEnabled()) return heuristic(signals, contacts, tz);
  // Small parallel batches: each call returns in a few seconds instead of one long call.
  const CHUNK = 8;
  const batches: Promise<unknown[]>[] = [];
  for (let start = 0; start < signals.length; start += CHUNK) {
    const part = signals.slice(start, start + CHUNK);
    batches.push(callGemini(promptFor(part, start, contacts, tz, today)));
  }
  return clean((await Promise.all(batches)).flat(), contacts, signals.length, today);
}

function promptFor(signals: SignalInput[], offset: number, contacts: Contact[], tz: string, today: string) {
  const emails = new Set(signals.flatMap((s) => s.participants.map((p) => p.email ?? "")).filter(Boolean));
  const items = signals.map((s, j) => [
    `[${offset + j}] ${s.source} · ${localDay(s.occurred_at, tz)}`,
    `title: ${s.title ?? "(none)"}`,
    s.detail ? `detail: ${s.detail}` : null,
    `with: ${s.participants.map((p) => [p.name, p.email].filter(Boolean).join(" ")).join("; ") || "(no guests listed)"}`,
  ].filter(Boolean).join("\n")).join("\n\n");
  return `Today: ${today}\n\nDirectory (id | name | emails | role):\n${directory(contacts, emails)}\n\nItems from the user's calendar and email:\n${items}\n\nPropose entries to log.`;
}

/** "I texted Mia about the hackathon yesterday" -> drafts. */
export async function draftsFromText(text: string, contacts: Contact[], tz: string): Promise<Draft[]> {
  const today = localDay(new Date().toISOString(), tz);
  if (!aiEnabled()) {
    if (process.env.DEMO_MODE === "1") return demoParse(text, contacts, today);
    throw new Error("AI isn't set up yet. Add GEMINI_API_KEY in Vercel.");
  }
  const prompt = `Today: ${today}\n\nDirectory (id | name | emails | role):\n${directory(contacts, new Set(), text)}\n\nThe user wrote about other conversations (texts, LinkedIn, Discord, in person):\n"""${text.slice(0, 4000)}"""\n\nPropose one entry per person mentioned. signal_index must be null. Capture any company, role, location, or how they met in new_person.`;
  return clean(await callGemini(prompt), contacts, 0, today);
}

/* ---------------- Offline fallbacks ---------------- */

function heuristic(signals: SignalInput[], contacts: Contact[], tz: string): Draft[] {
  const byEmail = new Map<string, Contact>();
  contacts.forEach((c) => c.emails.forEach((e) => byEmail.set(e.toLowerCase(), c)));
  const out: Draft[] = [];
  signals.forEach((s, i) => {
    for (const p of s.participants) {
      const c = p.email ? byEmail.get(p.email) : undefined;
      if (!c && !(s.source === "calendar" && p.name)) continue;
      out.push({
        signalIndex: i, contactId: c?.id ?? null,
        newPerson: c ? null : { name: p.name!, email: p.email },
        date: localDay(s.occurred_at, tz),
        kind: s.source === "calendar" ? "meeting" : "email",
        summary: s.title ? `${s.source === "calendar" ? "Met" : "Emailed"}: ${s.title}` : s.source === "calendar" ? "Met" : "Emailed",
        confidence: s.source === "calendar" ? 0.8 : 0.55,
      });
    }
  });
  return out;
}

/** Demo-only: "Name ... about X" per sentence. */
function demoParse(text: string, contacts: Contact[], today: string): Draft[] {
  return text.split(/[.;\n]+/).map((t) => t.trim()).filter(Boolean).flatMap((sentence) => {
    const known = contacts.find((c) => sentence.toLowerCase().includes(c.name.split(" ")[0].toLowerCase()));
    const m = sentence.match(/(?:with|texted|called|met|messaged|to)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)(?:\s+(?:from|at)\s+([A-Z][\w&]+))?/);
    if (!known && !m) return [];
    const about = sentence.match(/about (.+)$/i)?.[1];
    return [{
      signalIndex: null, contactId: known?.id ?? null,
      newPerson: known ? null : { name: m![1], company: m![2] ?? null, notes: sentence },
      date: today, kind: /text|dm|discord|linkedin|messag/i.test(sentence) ? "manual" : /call/i.test(sentence) ? "call" : "meeting",
      summary: about ? `Talked about ${about}` : "Talked", confidence: 0.9,
    } as Draft];
  });
}
