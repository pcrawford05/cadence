"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRepo } from "@/lib/session";
import { ImportRow } from "@/lib/csv";
import { ContactInput, ContactType, STATUSES, Status, TYPES } from "@/lib/types";
import { dayToISO, toDay } from "@/lib/cadence";

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/table");
  if (id) revalidatePath(`/contacts/${id}`);
}

export async function markTalked(id: string, summary?: string) {
  const repo = await getRepo();
  await repo.logInteraction({ contact_id: id, kind: "manual", source: "manual", summary: summary || "Talked" });
  await repo.updateContact(id, { snoozed_until: null });
  refresh(id);
}

export async function snooze(id: string, days: number) {
  const repo = await getRepo();
  await repo.updateContact(id, { snoozed_until: dayToISO(toDay(new Date()) + days) });
  refresh(id);
}

/** Skip this cycle: treat as handled without logging a conversation. */
export async function skipCycle(id: string) {
  const repo = await getRepo();
  const c = await repo.getContact(id);
  if (!c) return;
  const s = await repo.getSettings();
  const cad = c.cadence_days_override ?? (c.type ? s.cadence[c.type] : null) ?? 30;
  await repo.updateContact(id, { snoozed_until: dayToISO(toDay(new Date()) + cad) });
  refresh(id);
}

function formToContact(f: FormData): ContactInput {
  const str = (k: string) => {
    const v = String(f.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const type = str("type");
  const num = (k: string) => (str(k) ? Number(str(k)) : null);
  return {
    name: str("name") ?? "Unnamed",
    company: str("company"),
    location: str("location"),
    linkedin_url: str("linkedin_url"),
    phone: str("phone"),
    photo_url: str("photo_url"),
    emails: String(f.get("emails") ?? "").split(/[\s,;]+/).filter((e) => e.includes("@")).map((e) => e.toLowerCase()),
    date_met: str("date_met"),
    type: type && (TYPES as readonly string[]).includes(type) ? (type as ContactType) : null,
    statuses: f.getAll("statuses").map(String).filter((s): s is Status => (STATUSES as readonly string[]).includes(s)),
    priority_due: str("priority_due"),
    cadence_days_override: num("cadence_days_override"),
    strength: num("strength"),
    position: str("position"),
    notes: str("notes"),
  };
}

export async function saveContact(id: string | null, f: FormData) {
  const repo = await getRepo();
  const input: Partial<ContactInput> & { name: string } = formToContact(f);
  if (!input.photo_url) delete input.photo_url; // keep existing photo unless replaced
  let c = id ? await repo.updateContact(id, input) : await repo.createContact(input);
  const file = f.get("photo_file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5_000_000) throw new Error("Photo must be under 5 MB");
    c = await repo.updateContact(c.id, { photo_url: await repo.uploadPhoto(c.id, file) });
  }
  const lastTalked = String(f.get("last_talked") ?? "").trim();
  if (!id && lastTalked) await repo.logInteraction({ contact_id: c.id, occurred_at: lastTalked + "T12:00:00Z", kind: "manual", source: "manual", summary: "Added with last contact date" });
  refresh(c.id);
  redirect(`/contacts/${c.id}`);
}

export async function deleteContact(id: string) {
  const repo = await getRepo();
  await repo.deleteContact(id);
  refresh();
  redirect("/people");
}

export async function logInteraction(id: string, f: FormData) {
  const repo = await getRepo();
  const date = String(f.get("date") ?? "") || new Date().toISOString().slice(0, 10);
  await repo.logInteraction({
    contact_id: id,
    occurred_at: date + "T12:00:00Z",
    kind: (String(f.get("kind") ?? "manual") as "manual" | "call" | "meeting"),
    source: "manual",
    summary: String(f.get("summary") ?? "") || null,
  });
  refresh(id);
}

export async function importContacts(rows: ImportRow[]) {
  const repo = await getRepo();
  const n = await repo.importRows(rows);
  refresh();
  return n;
}

export async function saveSettings(f: FormData) {
  const repo = await getRepo();
  const cadence = Object.fromEntries(
    TYPES.map((t) => {
      const v = String(f.get(`cad_${t}`) ?? "").trim();
      return [t, v === "" ? null : Math.max(1, Number(v))];
    }),
  ) as Record<ContactType, number | null>;
  await repo.updateSettings({ cadence, digest_hour: Number(f.get("digest_hour") ?? 8), timezone: String(f.get("timezone") ?? "America/Los_Angeles") });
  refresh();
  revalidatePath("/settings");
}

/* ---------------- LinkedIn import + inbox ---------------- */

export async function importLinkedIn(text: string) {
  const { parseLinkedInConnections, planLinkedInMerge } = await import("@/lib/linkedin");
  const repo = await getRepo();
  const conns = parseLinkedInConnections(text);
  const plan = planLinkedInMerge(conns, await repo.listContacts());
  await repo.createMany(plan.create);
  for (const u of plan.update) await repo.updateContact(u.id, u.patch);
  refresh();
  revalidatePath("/inbox");
  return { found: conns.length, created: plan.create.length, updated: plan.update.length, unchanged: plan.unchanged };
}

/** Save a person's details from the inbox and mark them sorted. */
export async function triage(id: string, f: FormData) {
  const repo = await getRepo();
  const type = String(f.get("type") ?? "");
  const strength = Number(f.get("strength") ?? 0);
  const notes = String(f.get("notes") ?? "").trim();
  const statuses = f.getAll("statuses").map(String).filter((s): s is Status => (STATUSES as readonly string[]).includes(s));
  await repo.updateContact(id, {
    type: (TYPES as readonly string[]).includes(type) ? (type as ContactType) : null,
    strength: strength >= 1 && strength <= 7 ? strength : null,
    statuses,
    ...(notes ? { notes } : {}),
    triaged_at: new Date().toISOString(),
  });
  refresh(id);
  revalidatePath("/inbox");
}

/** Not someone to track: keep the record (so re-imports don't resurface them) but leave it untyped. */
export async function archiveFromInbox(id: string) {
  const repo = await getRepo();
  await repo.updateContact(id, { triaged_at: new Date().toISOString(), type: null, statuses: [] });
  refresh(id);
  revalidatePath("/inbox");
}

export async function saveInboxDaily(f: FormData) {
  const repo = await getRepo();
  await repo.updateSettings({ inbox_daily: Math.min(50, Math.max(0, Number(f.get("inbox_daily") ?? 5))) });
  revalidatePath("/settings");
  revalidatePath("/inbox");
}

/* ---------------- Photos ---------------- */

const MAX_PHOTO = 5_000_000;

/** Save a photo from an uploaded file or an image URL the user pasted or dropped. */
export async function setPhoto(id: string, f: FormData): Promise<{ error?: string }> {
  const repo = await getRepo();
  let file = f.get("file");
  const url = String(f.get("url") ?? "").trim();
  if (!(file instanceof File) && url) {
    if (!/^https:\/\//i.test(url)) return { error: "Only https image links are supported." };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const type = r.headers.get("content-type") ?? "";
      if (!r.ok || !type.startsWith("image/")) return { error: "That link isn't an image. Use Copy Image instead." };
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_PHOTO) return { error: "Image is over 5 MB." };
      file = new File([buf], "photo", { type });
    } catch {
      return { error: "Couldn't download that image. Use Copy Image instead." };
    }
  }
  if (!(file instanceof File) || file.size === 0) return { error: "No image found." };
  if (file.size > MAX_PHOTO) return { error: "Image is over 5 MB." };
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  const stored = await repo.uploadPhoto(id, file);
  await repo.updateContact(id, { photo_url: stored });
  refresh(id);
  revalidatePath("/inbox");
  return {};
}

/* ---------------- Inline field edits ---------------- */

const EDITABLE = {
  name: "text", company: "text", position: "text", location: "text", phone: "text", linkedin_url: "text", notes: "text",
  date_met: "date", priority_due: "date",
  cadence_days_override: "int", strength: "int",
  emails: "emails", type: "type", statuses: "statuses",
} as const;
export type EditableField = keyof typeof EDITABLE;

/** Save one field from the profile page. Returns the saved value (normalized) or an error. */
export async function updateField(id: string, field: EditableField, raw: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const kind = EDITABLE[field];
  if (!kind) return { ok: false, error: "Not editable" };
  let value: unknown = null;
  const s = typeof raw === "string" ? raw.trim() : raw;
  switch (kind) {
    case "text":
      value = s === "" ? null : String(s).slice(0, 5000);
      if (field === "name" && !value) return { ok: false, error: "Name can't be empty" };
      break;
    case "date":
      if (s && !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return { ok: false, error: "Use a date" };
      value = s || null;
      break;
    case "int": {
      if (s === "" || s == null) { value = null; break; }
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1) return { ok: false, error: "Use a whole number" };
      if (field === "strength" && n > 7) return { ok: false, error: "1 to 7" };
      value = n;
      break;
    }
    case "emails":
      value = String(s ?? "").split(/[\s,;]+/).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).map((e) => e.toLowerCase());
      break;
    case "type":
      value = s && (TYPES as readonly string[]).includes(String(s)) ? s : null;
      break;
    case "statuses":
      value = Array.isArray(s) ? s.filter((x): x is Status => (STATUSES as readonly string[]).includes(String(x))) : [];
      break;
  }
  const repo = await getRepo();
  await repo.updateContact(id, { [field]: value } as Partial<ContactInput>);
  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/table");
  revalidatePath(`/contacts/${id}`);
  return { ok: true, value };
}

/* ---------------- Command palette ---------------- */

export async function paletteIndex() {
  const repo = await getRepo();
  return (await repo.listContacts()).map((c) => ({
    id: c.id, name: c.name, sub: [c.position, c.company].filter(Boolean).join(" at ") || c.location || "",
    photo: c.photo_url, type: c.type, sorted: !!c.triaged_at,
  }));
}
