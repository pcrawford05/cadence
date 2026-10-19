import { parseCSV } from "./csv";
import { Contact, ContactInput } from "./types";

/** One row of LinkedIn's Connections.csv export. */
export interface LinkedInConnection {
  first: string;
  last: string;
  url: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
  connectedOn: string | null; // YYYY-MM-DD
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** LinkedIn writes "19 Oct 2026"; older exports use "10/19/26". */
export function parseConnectedOn(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

/** "https://www.linkedin.com/in/Jane-Doe/?x=1" -> "linkedin.com/in/jane-doe" */
export function normalizeLinkedInUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const m = u.trim().toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/);
  return m ? `linkedin.com/in/${decodeURIComponent(m[1])}` : null;
}

export const isLinkedInExport = (text: string) => /first name\s*,\s*last name/i.test(text.slice(0, 3000)) && /connected on/i.test(text.slice(0, 3000));

/** LinkedIn prepends a few "Notes:" lines before the real header; skip to it. */
export function parseLinkedInConnections(text: string): LinkedInConnection[] {
  const rows = parseCSV(text);
  const h = rows.findIndex((r) => r.some((c) => /^first name$/i.test(c.trim())));
  if (h < 0) return [];
  const idx = (name: string) => rows[h].findIndex((c) => c.trim().toLowerCase() === name);
  const col = { first: idx("first name"), last: idx("last name"), url: idx("url"), email: idx("email address"), company: idx("company"), position: idx("position"), on: idx("connected on") };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() || null : null);
  return rows.slice(h + 1)
    .map((r) => ({
      first: get(r, col.first) ?? "",
      last: get(r, col.last) ?? "",
      url: get(r, col.url),
      email: get(r, col.email)?.toLowerCase() ?? null,
      company: get(r, col.company),
      position: get(r, col.position),
      connectedOn: get(r, col.on) ? parseConnectedOn(get(r, col.on)!) : null,
    }))
    .filter((c) => (c.first || c.last)); // LinkedIn leaves rows blank for members who hid their name
}

export interface MergePlan {
  create: ContactInput[];
  update: { id: string; name: string; patch: Partial<ContactInput> }[];
  unchanged: number;
}

const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Match each connection to an existing contact by LinkedIn URL, then email, then exact name.
 * Matches only fill blank fields (never overwrite your edits). New people enter the inbox untriaged.
 */
export function planLinkedInMerge(conns: LinkedInConnection[], existing: Contact[]): MergePlan {
  const byUrl = new Map<string, Contact>();
  const byEmail = new Map<string, Contact>();
  const byName = new Map<string, Contact>();
  existing.forEach((c) => {
    const u = normalizeLinkedInUrl(c.linkedin_url);
    if (u) byUrl.set(u, c);
    c.emails.forEach((e) => byEmail.set(e.toLowerCase(), c));
    byName.set(nameKey(c.name), c);
  });

  const plan: MergePlan = { create: [], update: [], unchanged: 0 };
  const seen = new Set<string>();
  for (const k of conns) {
    const name = `${k.first} ${k.last}`.trim();
    const url = normalizeLinkedInUrl(k.url);
    const dedupe = url ?? nameKey(name);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const match = (url && byUrl.get(url)) || (k.email && byEmail.get(k.email)) || byName.get(nameKey(name));
    if (match) {
      const patch: Partial<ContactInput> = {};
      if (!match.linkedin_url && k.url) patch.linkedin_url = k.url;
      if (!match.company && k.company) patch.company = k.company;
      if (!match.position && k.position) patch.position = k.position;
      if (!match.linkedin_connected_on && k.connectedOn) patch.linkedin_connected_on = k.connectedOn;
      if (k.email && !match.emails.includes(k.email)) patch.emails = [...match.emails, k.email];
      if (Object.keys(patch).length) plan.update.push({ id: match.id, name: match.name, patch });
      else plan.unchanged++;
    } else {
      plan.create.push({
        name,
        linkedin_url: k.url,
        emails: k.email ? [k.email] : [],
        company: k.company,
        position: k.position,
        linkedin_connected_on: k.connectedOn,
        source: "linkedin",
        triaged_at: null,
        statuses: [],
      });
    }
  }
  return plan;
}
