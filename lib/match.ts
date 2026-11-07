import type { Contact } from "./types";

/**
 * Deterministic matching of a person from a signal to an existing contact.
 *
 * Gemini also matches, but it only sees a slice of the directory and the
 * follow-up check only compares exact emails, so real people slip through
 * as "new" and approving the proposal creates a duplicate. This runs after
 * the model (and in the offline fallback) to catch what it missed.
 *
 * Steps, in order:
 * 1. Normalized email match (case, +tags, Gmail dots).
 * 2. Email local-part tokens carry the contact's first and last name
 *    (isasilva@hiafan.com matches Isael Silva; yahayandutu matches Yahaya Ndutu).
 * 3. Normalized full-name match, tolerant of "Last, First" order, middle
 *    names, and first-name shortenings (Isa Silva matches Isael Silva).
 * 4. First-name-only match, only when exactly one contact has that name.
 *
 * Any step that matches more than one contact is ambiguous and returns null,
 * so two people sharing a first name (Dan Wu, Dan Wadhwani) never merge.
 */

export function normalizeEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const local = rawLocal.split("+")[0];
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  const cleanLocal = domain === "gmail.com" ? local.replace(/\./g, "") : local;
  return `${cleanLocal}@${domain}`;
}

/** Tokens of the local part: "isa.silva" -> ["isa", "silva"]. */
export function emailLocalTokens(email: string): string[] {
  return normalizeEmail(email).split("@")[0].split(/[._-]+/).filter(Boolean);
}

/** "Crawford, Jack" -> ["jack", "crawford"]; "Mary-Jane Okafor" -> ["mary", "jane", "okafor"]. */
export function nameTokens(name: string): string[] {
  const folded = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const [beforeComma, afterComma] = folded.split(",");
  const ordered = afterComma !== undefined ? `${afterComma} ${beforeComma}` : folded;
  return ordered.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

const firstOf = (tokens: string[]) => tokens[0] ?? "";
const lastOf = (tokens: string[]) => tokens[tokens.length - 1] ?? "";

/** First names match when equal, or when one is a shortening of the other (Isa / Isael). */
function firstMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return short.length >= 3 && long.startsWith(short);
}

/** Two multi-token names match when the first and last names line up; middle names are ignored. */
export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  return firstMatches(firstOf(ta), firstOf(tb)) && lastOf(ta) === lastOf(tb);
}

/** True when the contact is a plausible match for a signal's emails or words (directory relevance). */
export function matchesFocus(contact: Contact, focusEmails: Set<string>, focusWords: Set<string>): boolean {
  if (contact.emails.some((e) => focusEmails.has(normalizeEmail(e)))) return true;
  const tokens = nameTokens(contact.name);
  if (tokens.some((t) => focusWords.has(t))) return true;
  // A signal from isasilva@hiafan.com should surface a contact named Isael Silva.
  const focusLocal = new Set([...focusEmails].flatMap((e) => emailLocalTokens(e)));
  return tokens.some((t) => focusLocal.has(t));
}

export interface PersonRef {
  name?: string | null;
  email?: string | null;
}

export function matchContact(person: PersonRef, contacts: Contact[]): Contact | null {
  const email = person.email?.trim() ? normalizeEmail(person.email) : null;
  const name = person.name?.trim() ? person.name.trim() : null;

  // 1. Exact email, after normalization.
  if (email) {
    const hit = contacts.find((c) => c.emails.some((e) => normalizeEmail(e) === email));
    if (hit) return hit;
  }

  // 2. Email local part carries first and last name, joined or dotted.
  if (email) {
    const joined = emailLocalTokens(email).join("");
    const hits = contacts.filter((c) => {
      const t = nameTokens(c.name);
      if (t.length < 2) return false;
      const first = firstOf(t);
      let firstHit = joined.includes(first);
      for (let len = first.length - 1; len >= 3 && !firstHit; len--) firstHit = joined.includes(first.slice(0, len));
      return joined.includes(lastOf(t)) && firstHit;
    });
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;
  }

  // 3. Full name, tolerant of order, middles, and shortenings.
  if (name) {
    const tokens = nameTokens(name);
    if (tokens.length >= 2) {
      const hits = contacts.filter((c) => namesMatch(name, c.name));
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) return null;
    }
    // 4. First name only, and only when it is unambiguous in the directory.
    if (tokens.length === 1 && tokens[0].length > 2) {
      const hits = contacts.filter((c) => firstOf(nameTokens(c.name)) === tokens[0]);
      if (hits.length === 1) return hits[0];
    }
  }
  return null;
}
