import { describe, expect, it } from "vitest";
import { emailLocalTokens, matchContact, nameTokens, namesMatch, normalizeEmail } from "../lib/match";
import type { Contact } from "../lib/types";

const contact = (o: Partial<Contact>): Contact => ({
  id: "x", user_id: "u", name: "", photo_url: null, company: null, linkedin_url: null, emails: [], phone: null, location: null,
  date_met: null, type: "purple", cadence_days_override: null, statuses: [], priority_due: null, strength: null, position: null,
  source: "manual", linkedin_connected_on: null, triaged_at: "2026-01-01", notes: null, snoozed_until: null, last_contact_at: null,
  created_at: "2026-01-01", ...o,
});

// Real cases from the user's calendar and email, Nov 2026.
const jack = contact({ id: "c-jack", name: "Jack Crawford", emails: ["jack@impactvc.com"] });
const kyan = contact({ id: "c-kyan", name: "Kyan Chiang", emails: ["kyan@applisolutions.com"] });
const isael = contact({ id: "c-isa", name: "Isael Silva", emails: ["isasilva@hiafan.com"] });
const yahaya = contact({ id: "c-yahaya", name: "Yahaya Ndutu", emails: ["yahayandutu@hiafan.com"] });
const danWu = contact({ id: "c-danwu", name: "Dan Wu", emails: ["dan@heyjoyful.com"] });
const danWadhwani = contact({ id: "c-danwad", name: "Dan Wadhwani", emails: ["dwadhwani@marshall.usc.edu"] });
const maya = contact({ id: "c-maya", name: "Maya Okafor", emails: ["maya.okafor@gmail.com"] });
const contacts = [jack, kyan, isael, yahaya, danWu, danWadhwani, maya];

describe("normalizeEmail", () => {
  it("lowercases, strips plus tags, and ignores Gmail dots", () => {
    expect(normalizeEmail("Maya.Okafor+news@gmail.com")).toBe("mayaokafor@gmail.com");
    expect(normalizeEmail("Sam@X.COM")).toBe("sam@x.com");
    expect(normalizeEmail("sam@googlemail.com")).toBe("sam@gmail.com");
  });
  it("keeps dots for non-Gmail domains", () => {
    expect(normalizeEmail("jack.crawford@ci.vc")).toBe("jack.crawford@ci.vc");
  });
});

describe("nameTokens", () => {
  it("flips Last, First display names from Google Calendar", () => {
    expect(nameTokens("Crawford, Jack")).toEqual(["jack", "crawford"]);
    expect(nameTokens("Wadhwani, Dan")).toEqual(["dan", "wadhwani"]);
  });
});

describe("namesMatch", () => {
  it("matches shortenings when the last name lines up", () => {
    expect(namesMatch("Isa Silva", "Isael Silva")).toBe(true);
    expect(namesMatch("Rob Smith", "Robert Smith")).toBe(true);
  });
  it("does not match different last names", () => {
    expect(namesMatch("Dan Wu", "Dan Wadhwani")).toBe(false);
  });
});

describe("matchContact", () => {
  it("matches a second address for the same person", () => {
    expect(matchContact({ name: "Jack Crawford", email: "jack.crawford@ci.vc" }, contacts)?.id).toBe("c-jack");
    expect(matchContact({ name: "Kyan Chiang", email: "kyan@forumvc.com" }, contacts)?.id).toBe("c-kyan");
  });
  it("matches a third address by its Last, First display name", () => {
    expect(matchContact({ name: "Crawford, Jack", email: "jackc553@marshall.usc.edu" }, contacts)?.id).toBe("c-jack");
  });
  it("matches when the email local part carries the name", () => {
    expect(emailLocalTokens("isasilva@hiafan.com")).toEqual(["isasilva"]);
    expect(matchContact({ name: null, email: "yahayandutu@hiafan.com" }, contacts)?.id).toBe("c-yahaya");
  });
  it("matches a shortened first name", () => {
    expect(matchContact({ name: "Isa Silva", email: "isasilva@hiafan.com" }, contacts)?.id).toBe("c-isa");
  });
  it("matches a unique first name, but never an ambiguous one", () => {
    expect(matchContact({ name: "Maya", email: null }, contacts)?.id).toBe("c-maya");
    expect(matchContact({ name: "Dan", email: "dan@unknown.com" }, contacts)).toBeNull();
  });
  it("tells the two Dans apart by full name and by email", () => {
    expect(matchContact({ name: "Dan Wadhwani", email: "danwadhwani1@gmail.com" }, contacts)?.id).toBe("c-danwad");
    expect(matchContact({ name: "Dan", email: "dan@heyjoyful.com" }, contacts)?.id).toBe("c-danwu");
  });
  it("does not match a username display name to a real name", () => {
    expect(matchContact({ name: "rbsuzu", email: "rbsuzu@gmail.com" }, contacts)).toBeNull();
  });
  it("does not match two contacts who share a name", () => {
    const dupes = [contact({ id: "a", name: "Sam Ortiz" }), contact({ id: "b", name: "Sam Ortiz" })];
    expect(matchContact({ name: "Sam Ortiz", email: "sam@other.com" }, dupes)).toBeNull();
  });
  it("returns null for a genuinely new person", () => {
    expect(matchContact({ name: "New Person", email: "new@y.com" }, contacts)).toBeNull();
  });
});
