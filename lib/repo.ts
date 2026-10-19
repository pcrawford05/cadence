import type { SupabaseClient } from "@supabase/supabase-js";
import { ImportRow } from "./csv";
import {
  CadenceSettings, Contact, ContactInput, DEFAULT_CADENCE, Interaction, InteractionKind, InteractionSource,
} from "./types";
import { seedContacts, seedInteractions } from "./demo-data";

export interface LogInput {
  contact_id: string;
  occurred_at?: string;
  kind: InteractionKind;
  source: InteractionSource;
  summary?: string | null;
  external_id?: string | null;
}

export interface Settings {
  cadence: CadenceSettings;
  digest_hour: number;
  timezone: string;
  google_email: string | null;
  google_last_sync: string | null;
  has_mcp_token: boolean;
}

export interface Repo {
  userId: string;
  listContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | null>;
  createContact(input: ContactInput): Promise<Contact>;
  updateContact(id: string, patch: Partial<ContactInput>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  listInteractions(contactId: string): Promise<Interaction[]>;
  logInteraction(i: LogInput): Promise<Interaction | null>; // null = duplicate external_id
  getSettings(): Promise<Settings>;
  updateSettings(p: Partial<Pick<Settings, "cadence" | "digest_hour" | "timezone">>): Promise<void>;
  importRows(rows: ImportRow[]): Promise<number>;
  /** Stores the image and returns the value to save in photo_url. */
  uploadPhoto(contactId: string, file: File): Promise<string>;
}

/** Photos in private storage are saved as "storage:<path>" and served through /api/photo/<id>. */
function resolvePhoto(c: Contact): Contact {
  return c.photo_url?.startsWith("storage:") ? { ...c, photo_url: `/api/photo/${c.id}` } : c;
}

const CONTACT_FIELDS = [
  "name", "photo_url", "company", "linkedin_url", "emails", "phone", "location", "date_met", "type",
  "cadence_days_override", "statuses", "priority_due", "linkedin_strength", "notes", "snoozed_until",
] as const;

function pick(p: Partial<ContactInput>) {
  const out: Record<string, unknown> = {};
  for (const k of CONTACT_FIELDS) if (k in p) out[k] = (p as Record<string, unknown>)[k];
  return out;
}

/* ---------------- Supabase ---------------- */

export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient, public userId: string) {}

  async listContacts() {
    const { data, error } = await this.db.from("contacts").select("*").eq("user_id", this.userId).order("name");
    if (error) throw error;
    return (data as Contact[]).map(resolvePhoto);
  }
  async getContact(id: string) {
    const { data } = await this.db.from("contacts").select("*").eq("user_id", this.userId).eq("id", id).maybeSingle();
    return data ? resolvePhoto(data as Contact) : null;
  }
  async createContact(input: ContactInput) {
    const { data, error } = await this.db.from("contacts").insert({ ...pick(input), user_id: this.userId }).select().single();
    if (error) throw error;
    return data as Contact;
  }
  async updateContact(id: string, patch: Partial<ContactInput>) {
    const { data, error } = await this.db.from("contacts").update(pick(patch)).eq("user_id", this.userId).eq("id", id).select().single();
    if (error) throw error;
    return data as Contact;
  }
  async deleteContact(id: string) {
    const { error } = await this.db.from("contacts").delete().eq("user_id", this.userId).eq("id", id);
    if (error) throw error;
  }
  async listInteractions(contactId: string) {
    const { data, error } = await this.db.from("interactions").select("*").eq("user_id", this.userId)
      .eq("contact_id", contactId).order("occurred_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data as Interaction[];
  }
  async logInteraction(i: LogInput) {
    const row = { ...i, occurred_at: i.occurred_at ?? new Date().toISOString(), user_id: this.userId };
    const { data, error } = await this.db.from("interactions").insert(row).select().single();
    if (error) {
      if (error.code === "23505") return null; // already logged
      throw error;
    }
    return data as Interaction;
  }
  async getSettings(): Promise<Settings> {
    const { data } = await this.db.from("user_settings").select("*").eq("user_id", this.userId).maybeSingle();
    return {
      cadence: { ...DEFAULT_CADENCE, ...(data?.cadence ?? {}) },
      digest_hour: data?.digest_hour ?? 8,
      timezone: data?.timezone ?? "America/Los_Angeles",
      google_email: data?.google_email ?? null,
      google_last_sync: data?.google_last_sync ?? null,
      has_mcp_token: !!data?.mcp_token_hash,
    };
  }
  async updateSettings(p: Partial<Pick<Settings, "cadence" | "digest_hour" | "timezone">>) {
    const { error } = await this.db.from("user_settings").upsert({ user_id: this.userId, ...p });
    if (error) throw error;
  }
  async importRows(rows: ImportRow[]) {
    let n = 0;
    for (const r of rows) {
      const c = await this.createContact(r.contact);
      if (r.lastContact) await this.logInteraction({ contact_id: c.id, occurred_at: r.lastContact + "T12:00:00Z", kind: "manual", source: "import", summary: "Imported from spreadsheet" });
      n++;
    }
    return n;
  }
  async uploadPhoto(contactId: string, file: File) {
    const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
    const path = `${this.userId}/${contactId}.${ext}`;
    const { error } = await this.db.storage.from("photos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return `storage:${path}`;
  }
  async photoPath(contactId: string) {
    const { data } = await this.db.from("contacts").select("photo_url").eq("user_id", this.userId).eq("id", contactId).maybeSingle();
    return data?.photo_url?.startsWith("storage:") ? (data.photo_url as string).slice(8) : null;
  }
}

/* ---------------- Demo (in memory) ---------------- */

type Store = { contacts: Contact[]; interactions: Interaction[]; settings: Settings };
const g = globalThis as unknown as { __cadenceDemo?: Store };

function store(): Store {
  if (!g.__cadenceDemo) {
    g.__cadenceDemo = {
      contacts: seedContacts(),
      interactions: seedInteractions(),
      settings: { cadence: { ...DEFAULT_CADENCE }, digest_hour: 8, timezone: "America/Los_Angeles", google_email: "demo@example.com", google_last_sync: new Date(Date.now() - 3.6e6 * 7).toISOString(), has_mcp_token: false },
    };
  }
  return g.__cadenceDemo;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export class DemoRepo implements Repo {
  userId = "demo-user";
  async listContacts() { return [...store().contacts].sort((a, b) => a.name.localeCompare(b.name)); }
  async getContact(id: string) { return store().contacts.find((c) => c.id === id) ?? null; }
  async createContact(input: ContactInput) {
    const c: Contact = {
      id: uid(), user_id: this.userId, created_at: new Date().toISOString(), last_contact_at: null,
      photo_url: null, company: null, linkedin_url: null, emails: [], phone: null, location: null, date_met: null,
      type: null, cadence_days_override: null, statuses: [], priority_due: null, linkedin_strength: null,
      notes: null, snoozed_until: null, ...(pick(input) as ContactInput),
    } as Contact;
    store().contacts.push(c);
    return c;
  }
  async updateContact(id: string, patch: Partial<ContactInput>) {
    const c = store().contacts.find((x) => x.id === id);
    if (!c) throw new Error("Not found");
    Object.assign(c, pick(patch));
    return c;
  }
  async deleteContact(id: string) {
    const s = store();
    s.contacts = s.contacts.filter((c) => c.id !== id);
    s.interactions = s.interactions.filter((i) => i.contact_id !== id);
  }
  async listInteractions(contactId: string) {
    return store().interactions.filter((i) => i.contact_id === contactId).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }
  async logInteraction(i: LogInput) {
    const s = store();
    if (i.external_id && s.interactions.some((x) => x.source === i.source && x.external_id === i.external_id)) return null;
    const row: Interaction = { id: uid(), user_id: this.userId, summary: null, external_id: null, ...i, occurred_at: i.occurred_at ?? new Date().toISOString() } as Interaction;
    s.interactions.push(row);
    const c = s.contacts.find((x) => x.id === i.contact_id);
    if (c && (!c.last_contact_at || c.last_contact_at < row.occurred_at)) c.last_contact_at = row.occurred_at;
    return row;
  }
  async getSettings() { return store().settings; }
  async updateSettings(p: Partial<Pick<Settings, "cadence" | "digest_hour" | "timezone">>) { Object.assign(store().settings, p); }
  async importRows(rows: ImportRow[]) {
    for (const r of rows) {
      const c = await this.createContact(r.contact);
      if (r.lastContact) await this.logInteraction({ contact_id: c.id, occurred_at: r.lastContact + "T12:00:00Z", kind: "manual", source: "import", summary: "Imported from spreadsheet" });
    }
    return rows.length;
  }
  async uploadPhoto(_id: string, file: File) {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return `data:${file.type};base64,${b64}`;
  }
}
