import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftsFromSignals, draftsFromText } from "../lib/ai";
import type { Contact } from "../lib/types";

const contact = (o: Partial<Contact>): Contact => ({
  id: "x", user_id: "u", name: "", photo_url: null, company: null, linkedin_url: null, emails: [], phone: null, location: null,
  date_met: null, type: "purple", cadence_days_override: null, statuses: [], priority_due: null, strength: null, position: null,
  source: "manual", linkedin_connected_on: null, triaged_at: "2026-01-01", notes: null, snoozed_until: null, last_contact_at: null,
  created_at: "2026-01-01", ...o,
});
const contacts = [contact({ id: "c-maya", name: "Maya Okafor", emails: ["maya@x.com"] }), contact({ id: "c-sam", name: "Sam Ortiz", emails: ["sam@x.com"] })];

function mockGemini(entries: unknown[]) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ entries }) }] } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Gemini output is validated", () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = "test"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; });

  it("keeps real ids, drops invented ids, maps new people with known emails", async () => {
    const f = mockGemini([
      { signal_index: 0, contact_id: "c-maya", date: "2026-10-21", kind: "meeting", summary: "Talked seed round", confidence: 0.9 },
      { signal_index: 0, contact_id: "c-FAKE", date: "2026-10-21", kind: "meeting", summary: "x", confidence: 0.9 },
      { signal_index: 9, contact_id: null, new_person: { name: "Sam", email: "SAM@x.com" }, date: "2026-10-20", kind: "email", summary: "Emailed", confidence: 0.6 },
      { signal_index: null, contact_id: null, new_person: { name: "Sarah Lin", email: "sarah@stripe.com", company: "Stripe" }, date: "2999-01-01", kind: "weird", summary: "", confidence: 7 },
    ]);
    const d = await draftsFromSignals([{ source: "calendar", occurred_at: "2026-10-21T20:00:00Z", title: "Coffee", detail: null, participants: [{ email: "maya@x.com", name: "Maya" }] }], contacts, "America/Los_Angeles");
    expect(f).toHaveBeenCalledOnce();
    expect(d.map((x) => x.contactId ?? x.newPerson?.name)).toEqual(["c-maya", "c-sam", "Sarah Lin"]);
    expect(d[1].signalIndex).toBeNull(); // out-of-range index dropped
    expect(d[2]).toMatchObject({ kind: "meeting", summary: "Talked", confidence: 1 }); // sanitized
    expect(d[2].date <= new Date().toISOString().slice(0, 10)).toBe(true); // future date clamped
  });

  it("one entry per person per day", async () => {
    mockGemini([
      { contact_id: "c-maya", date: "2026-10-21", kind: "meeting", summary: "a", confidence: 0.9 },
      { contact_id: "c-maya", date: "2026-10-21", kind: "email", summary: "b", confidence: 0.6 },
    ]);
    expect(await draftsFromText("coffee with maya", contacts, "America/Los_Angeles")).toHaveLength(1);
  });

  it("surfaces rate limits clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    await expect(draftsFromText("hi", contacts, "America/Los_Angeles")).rejects.toThrow(/free limit/);
  });
});

describe("without a key", () => {
  it("rule-based pass matches known emails and named calendar guests", async () => {
    delete process.env.GEMINI_API_KEY;
    const d = await draftsFromSignals([
      { source: "gmail", occurred_at: "2026-10-21T20:00:00Z", title: "Re: intro", detail: null, participants: [{ email: "sam@x.com", name: "Sam" }, { email: "rando@x.com", name: "Rando" }] },
      { source: "calendar", occurred_at: "2026-10-21T20:00:00Z", title: "Chat", detail: null, participants: [{ email: "new@y.com", name: "New Person" }] },
    ], contacts, "America/Los_Angeles");
    expect(d.map((x) => x.contactId ?? x.newPerson?.name)).toEqual(["c-sam", "New Person"]);
  });
});
