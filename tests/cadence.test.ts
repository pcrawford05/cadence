import { describe, expect, it } from "vitest";
import { computeDue, digestText, dueList, shouldNotify, suggestStatuses } from "../lib/cadence";
import { mapRows, parseByEndOf, parseCSV, parseDate } from "../lib/csv";
import { Contact } from "../lib/types";

const today = new Date("2026-10-19T12:00:00Z");
const base = (o: Partial<Contact>): Contact => ({
  id: "1", user_id: "u", name: "Test", photo_url: null, company: null, linkedin_url: null, emails: [],
  phone: null, location: null, date_met: null, type: null, cadence_days_override: null, statuses: [],
  priority_due: null, linkedin_strength: null, notes: null, snoozed_until: null, last_contact_at: null,
  created_at: "2026-10-01T00:00:00Z", ...o,
});

describe("computeDue", () => {
  it("orange = 30 days after last contact", () => {
    const d = computeDue(base({ type: "orange", last_contact_at: "2026-09-21T00:00:00Z" }), today);
    expect(d.nextDue).toBe("2026-10-21");
    expect(d.daysOverdue).toBe(-2);
  });
  it("red overdue", () => {
    const d = computeDue(base({ type: "red", last_contact_at: "2026-09-21" }), today);
    expect(d.daysOverdue).toBe(14);
  });
  it("purple never due", () => {
    expect(computeDue(base({ type: "purple", last_contact_at: "2020-01-01" }), today).nextDue).toBeNull();
  });
  it("falls back to date met", () => {
    expect(computeDue(base({ type: "blue", date_met: "2025-10-19" }), today).daysOverdue).toBe(0);
  });
  it("no dates = not due", () => {
    expect(computeDue(base({ type: "orange", statuses: ["new"] }), today).nextDue).toBeNull();
  });
  it("priority pulls in deadline", () => {
    const d = computeDue(base({ type: "blue", last_contact_at: "2026-10-01", statuses: ["priority"], priority_due: "2026-10-25" }), today);
    expect(d.nextDue).toBe("2026-10-25");
    expect(d.reason).toBe("priority");
  });
  it("priority without deadline = created + 14", () => {
    expect(computeDue(base({ type: "purple", statuses: ["priority"] }), today).nextDue).toBe("2026-10-15");
  });
  it("snooze pushes out", () => {
    const d = computeDue(base({ type: "red", last_contact_at: "2026-09-01", snoozed_until: "2026-10-26" }), today);
    expect(d.nextDue).toBe("2026-10-26");
    expect(d.reason).toBe("snoozed");
  });
  it("override beats type", () => {
    expect(computeDue(base({ type: "blue", cadence_days_override: 7, last_contact_at: "2026-10-12" }), today).daysOverdue).toBe(0);
  });
});

describe("statuses and digest", () => {
  it("suggests active / dormant", () => {
    expect(suggestStatuses(base({ type: "orange", last_contact_at: "2026-10-10", statuses: ["nurture"] }), today)).toEqual(["active", "nurture"]);
    expect(suggestStatuses(base({ type: "red", last_contact_at: "2026-08-01" }), today)).toEqual(["dormant"]);
  });
  it("weekly re-nag", () => {
    expect([0, 1, 7, 14, -1].map(shouldNotify)).toEqual([true, false, true, true, false]);
  });
  it("digest text", () => {
    const list = dueList([
      base({ id: "a", name: "A", type: "red", last_contact_at: "2026-10-05" }),
      base({ id: "b", name: "B", type: "red", last_contact_at: "2026-09-28" }),
      base({ id: "c", name: "C", type: "red", last_contact_at: "2026-10-10" }),
    ], today);
    expect(list.map((x) => x.contact.name)).toEqual(["B", "A"]);
    expect(digestText(list)).toEqual({ title: "2 people to reach out to", body: "B, A" });
  });
});

describe("csv import", () => {
  it("parses quoted csv", () => {
    expect(parseCSV('a,"b,c","d ""q"""\n1,2,3')).toEqual([["a", "b,c", 'd "q"'], ["1", "2", "3"]]);
  });
  it("dates", () => {
    expect(parseDate("9/21/2026")).toBe("2026-09-21");
    expect(parseDate("")).toBeNull();
  });
  it("by end of July rolls to next year", () => {
    expect(parseByEndOf("By end of July", today)).toBe("2027-07-31");
  });
  it("maps the existing sheet", () => {
    const csv = `Image,Name,Company,LinkedIn,Email,Phone,Location,Date Met,Last Contact Date,Type,Status,Notes
,Jordan Vale,Acme,linkedin.com/in/jvale,,,LA,9/1/2024,9/21/2026,Orange,"Nurture, Priority",By end of July
,Sam Ortiz,,https://www.linkedin.com/in/sortiz/,,,,9/21/2026,9/21/2026,,,LinkedIn relationship level: 3/5
,Riley Park,,,,,,,,Blue,,`;
    const rows = mapRows(parseCSV(csv), today);
    expect(rows).toHaveLength(3);
    expect(rows[0].contact).toMatchObject({ type: "orange", statuses: ["nurture", "priority"], priority_due: "2027-07-31", linkedin_url: "https://www.linkedin.com/in/jvale", date_met: "2024-09-01" });
    expect(rows[0].lastContact).toBe("2026-09-21");
    expect(rows[1].contact.linkedin_strength).toBe(3);
    expect(rows[2].contact.statuses).toEqual(["new"]);
  });
});
