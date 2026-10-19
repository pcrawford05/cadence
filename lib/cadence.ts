import { CadenceSettings, Contact, DEFAULT_CADENCE, Status } from "./types";

const DAY = 86_400_000;

export function toDay(d: string | Date): number {
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d;
  return Math.floor(date.getTime() / DAY);
}

export function dayToISO(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

export function cadenceFor(c: Pick<Contact, "type" | "cadence_days_override">, s: CadenceSettings = DEFAULT_CADENCE) {
  if (c.cadence_days_override && c.cadence_days_override > 0) return c.cadence_days_override;
  if (!c.type) return null;
  return s[c.type];
}

export interface DueInfo {
  nextDue: string | null; // YYYY-MM-DD, null = never due
  daysOverdue: number | null; // positive = overdue, 0 = today, negative = upcoming
  reason: "cadence" | "priority" | "snoozed" | "none";
}

const PRIORITY_DEFAULT_DAYS = 14;

/**
 * Next due = last contact (or date met, or created) + cadence.
 * Priority pulls it in to the priority deadline (default: today + 14 days).
 * Purple / no type never comes due unless flagged Priority. Snooze pushes it out.
 * Contacts tagged New with no anchor date are not due until a date exists.
 */
export function computeDue(c: Contact, today: Date = new Date(), s: CadenceSettings = DEFAULT_CADENCE): DueInfo {
  const t = toDay(today);
  const cadence = cadenceFor(c, s);
  const anchor = c.last_contact_at ?? c.date_met ?? null;

  let due: number | null = null;
  let reason: DueInfo["reason"] = "none";

  if (cadence != null && anchor) {
    due = toDay(anchor) + cadence;
    reason = "cadence";
  }

  if (c.statuses.includes("priority")) {
    const p = c.priority_due ? toDay(c.priority_due) : toDay(c.created_at) + PRIORITY_DEFAULT_DAYS;
    if (due == null || p < due) {
      due = p;
      reason = "priority";
    }
  }

  if (due != null && c.snoozed_until && toDay(c.snoozed_until) > due) {
    due = toDay(c.snoozed_until);
    reason = "snoozed";
  }

  if (due == null) return { nextDue: null, daysOverdue: null, reason: "none" };
  return { nextDue: dayToISO(due), daysOverdue: t - due, reason };
}

/** Suggest Active or Dormant from recency; manual tags (nurture, priority, new) pass through. */
export function suggestStatuses(c: Contact, today: Date = new Date(), s: CadenceSettings = DEFAULT_CADENCE): Status[] {
  const manual = c.statuses.filter((x) => x === "nurture" || x === "priority" || x === "new");
  const cadence = cadenceFor(c, s);
  if (!c.last_contact_at || cadence == null) return dedupe([...manual, ...c.statuses.filter((x) => x === "active" || x === "dormant")]);
  const since = toDay(today) - toDay(c.last_contact_at);
  const auto: Status[] = since <= cadence / 2 ? ["active"] : since > cadence * 2 ? ["dormant"] : [];
  return dedupe([...auto, ...manual]);
}

function dedupe<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}

export interface DueItem {
  contact: Contact;
  due: DueInfo;
}

/** Contacts due within `horizonDays` (default today), most overdue first. */
export function dueList(contacts: Contact[], today = new Date(), s: CadenceSettings = DEFAULT_CADENCE, horizonDays = 0): DueItem[] {
  return contacts
    .map((contact) => ({ contact, due: computeDue(contact, today, s) }))
    .filter((x) => x.due.daysOverdue != null && x.due.daysOverdue >= -horizonDays)
    .sort((a, b) => (b.due.daysOverdue ?? 0) - (a.due.daysOverdue ?? 0));
}

/** Weekly re-nag rule for the push digest: notify on first due day, then every 7 days while overdue. */
export function shouldNotify(daysOverdue: number): boolean {
  return daysOverdue >= 0 && daysOverdue % 7 === 0;
}

export function digestText(items: DueItem[]): { title: string; body: string } | null {
  const notify = items.filter((i) => shouldNotify(i.due.daysOverdue ?? -1));
  if (notify.length === 0) return null;
  const names = notify.slice(0, 3).map((i) => i.contact.name);
  const more = notify.length > 3 ? ` and ${notify.length - 3} more` : "";
  return {
    title: `${notify.length} ${notify.length === 1 ? "person" : "people"} to reach out to`,
    body: names.join(", ") + more,
  };
}
