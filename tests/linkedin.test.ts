import { describe, expect, it } from "vitest";
import { isLinkedInExport, normalizeLinkedInUrl, parseConnectedOn, parseLinkedInConnections, planLinkedInMerge } from "../lib/linkedin";
import { inboxBatch, digestText } from "../lib/cadence";
import { Contact } from "../lib/types";

const EXPORT = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jordan,Vale,https://www.linkedin.com/in/jvale,,Acme,"Founder, CEO",19 Oct 2026
Sam,Ortiz,https://www.linkedin.com/in/SOrtiz/,sam@x.com,Figma,Designer,02 Mar 2025
,,,,,,01 Jan 2024
Jordan,Vale,https://www.linkedin.com/in/jvale,,Acme,Founder,19 Oct 2026
Nia,Park,https://www.linkedin.com/in/niapark,,,,15 Aug 2023
`;

const contact = (o: Partial<Contact>): Contact => ({
  id: "x", user_id: "u", name: "", photo_url: null, company: null, linkedin_url: null, emails: [], phone: null, location: null,
  date_met: null, type: null, cadence_days_override: null, statuses: [], priority_due: null, strength: null, position: null,
  source: "manual", linkedin_connected_on: null, triaged_at: "2026-01-01", notes: null, snoozed_until: null, last_contact_at: null,
  created_at: "2026-01-01", ...o,
});

describe("linkedin export", () => {
  it("detects and parses past the Notes preamble", () => {
    expect(isLinkedInExport(EXPORT)).toBe(true);
    const rows = parseLinkedInConnections(EXPORT);
    expect(rows).toHaveLength(4); // blank-name row dropped
    expect(rows[0]).toMatchObject({ first: "Jordan", company: "Acme", position: "Founder, CEO", connectedOn: "2026-10-19" });
    expect(rows[1].email).toBe("sam@x.com");
  });
  it("dates and urls", () => {
    expect(parseConnectedOn("02 Mar 2025")).toBe("2025-03-02");
    expect(parseConnectedOn("3/2/25")).toBe("2025-03-02");
    expect(normalizeLinkedInUrl("https://www.linkedin.com/in/SOrtiz/?trk=x")).toBe("linkedin.com/in/sortiz");
    expect(normalizeLinkedInUrl("linkedin.com/in/pierce-millar-7090bb274/?skipRedirect=true")).toBe("linkedin.com/in/pierce-millar-7090bb274");
  });
  it("merges by url, then name; fills blanks only; dedupes", () => {
    const existing = [
      contact({ id: "a", name: "Sam Ortiz", linkedin_url: "linkedin.com/in/sortiz", company: "Mine" }),
      contact({ id: "b", name: "Nia Park" }),
    ];
    const plan = planLinkedInMerge(parseLinkedInConnections(EXPORT), existing);
    expect(plan.create.map((c) => c.name)).toEqual(["Jordan Vale"]);
    expect(plan.create[0]).toMatchObject({ source: "linkedin", triaged_at: null });
    const sam = plan.update.find((u) => u.id === "a")!;
    expect(sam.patch.company).toBeUndefined(); // kept your value
    expect(sam.patch.emails).toEqual(["sam@x.com"]);
    expect(plan.update.find((u) => u.id === "b")!.patch.linkedin_url).toContain("niapark");
  });
});

describe("inbox", () => {
  const now = new Date("2026-10-19T18:00:00Z");
  it("serves 5 per day minus those already sorted today", () => {
    const untriaged = Array.from({ length: 12 }, (_, i) => contact({ id: `u${i}`, name: `U${i}`, triaged_at: null, source: "linkedin" }));
    const sortedToday = [0, 1].map((i) => contact({ id: `s${i}`, source: "linkedin", triaged_at: "2026-10-19T16:00:00Z" }));
    const b = inboxBatch([...untriaged, ...sortedToday], now, 5, "America/Los_Angeles");
    expect(b).toMatchObject({ remaining: 12, doneToday: 2, leftToday: 3 });
    expect(b.batch).toHaveLength(3);
  });
  it("digest mentions inbox even when nobody is due", () => {
    expect(digestText([], 3)).toEqual({ title: "3 new connections to sort", body: "Takes about a minute in your Cadence inbox" });
    expect(digestText([], 0)).toBeNull();
  });
});
