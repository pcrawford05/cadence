import { ContactInput, ContactType, STATUSES, Status, TYPES } from "./types";

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, newlines in fields). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const HEADER_MAP: Record<string, keyof ContactInput | "last_contact" | "skip"> = {
  image: "photo_url", photo: "photo_url",
  name: "name", company: "company",
  linkedin: "linkedin_url", email: "emails", emails: "emails", phone: "phone",
  location: "location", datemet: "date_met",
  lastcontactdate: "last_contact", lastcontact: "last_contact",
  type: "type", status: "statuses", notes: "notes",
};

/** Accepts M/D/YYYY, YYYY-MM-DD. Returns YYYY-MM-DD or null. */
export function parseDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

/** "By end of July" -> last day of that month, next occurrence on or after `today`. */
export function parseByEndOf(note: string, today = new Date()): string | null {
  const m = note.toLowerCase().match(/by end of (\w+)/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  if (mi < 0) return null;
  let y = today.getUTCFullYear();
  const end = new Date(Date.UTC(y, mi + 1, 0));
  if (end < today) y += 1;
  return new Date(Date.UTC(y, mi + 1, 0)).toISOString().slice(0, 10);
}

export interface ImportRow {
  contact: ContactInput;
  lastContact: string | null;
  warnings: string[];
}

export function mapRows(rows: string[][], today = new Date()): ImportRow[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => HEADER_MAP[norm(h)] ?? "skip");
  const out: ImportRow[] = [];
  for (const r of rows.slice(1)) {
    const c: ContactInput = { name: "", emails: [], statuses: [] };
    let lastContact: string | null = null;
    const warnings: string[] = [];
    header.forEach((key, i) => {
      const v = (r[i] ?? "").trim();
      if (!v || key === "skip") return;
      switch (key) {
        case "emails": c.emails = v.split(/[;,\s]+/).filter((e) => e.includes("@")).map((e) => e.toLowerCase()); break;
        case "statuses":
          c.statuses = v.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter((x): x is Status => (STATUSES as readonly string[]).includes(x));
          break;
        case "type": {
          const t = v.toLowerCase();
          if ((TYPES as readonly string[]).includes(t)) c.type = t as ContactType; else warnings.push(`Unknown type "${v}"`);
          break;
        }
        case "date_met": c.date_met = parseDate(v); break;
        case "last_contact": lastContact = parseDate(v); break;
        case "photo_url": if (/^https?:\/\//.test(v)) c.photo_url = v; break;
        case "linkedin_url": c.linkedin_url = v.startsWith("http") ? v : `https://www.${v.replace(/^www\./, "")}`; break;
        default: (c as Record<string, unknown>)[key] = v;
      }
    });
    if (!c.name) continue;
    if (c.notes) {
      const lvl = c.notes.match(/relationship level:\s*(\d)\s*\/\s*5/i);
      if (lvl) c.linkedin_strength = Number(lvl[1]);
      const by = parseByEndOf(c.notes, today);
      if (by) { c.priority_due = by; warnings.push(`Priority deadline set to ${by} from note`); }
    }
    if (!c.date_met && !lastContact) {
      if (!c.statuses?.includes("new")) c.statuses = [...(c.statuses ?? []), "new"];
      warnings.push("No dates; tagged New");
    }
    out.push({ contact: c, lastContact, warnings });
  }
  return out;
}
