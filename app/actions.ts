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
    linkedin_strength: num("linkedin_strength"),
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
