export const TYPES = ["red", "orange", "yellow", "green", "blue", "purple"] as const;
export type ContactType = (typeof TYPES)[number];

export const STATUSES = ["dormant", "active", "nurture", "priority", "new"] as const;
export type Status = (typeof STATUSES)[number];

export type ContactSource = "manual" | "import" | "linkedin" | "gmail" | "mcp" | "ai";

/** Most people are "When relevant": tracked, but never nagged about. */
export const DEFAULT_TYPE = "purple" as const;

/** Relationship strength, 1 (weakest) to 7 (strongest). */
export const STRENGTH_SCALE: Record<number, { label: string; hint: string }> = {
  1: { label: "Unknown", hint: "Connected, never really interacted" },
  2: { label: "Met once", hint: "One brief encounter" },
  3: { label: "Acquaintance", hint: "A few light interactions" },
  4: { label: "Familiar", hint: "Real conversation; they'd remember you" },
  5: { label: "Warm", hint: "Ongoing; they'd take your call" },
  6: { label: "Strong", hint: "Trusted; would go out of their way" },
  7: { label: "Inner circle", hint: "Close mentor or friend" },
};

/** Old sheet scale 1-5 to 1-7 (1,2,3,4,5 -> 1,3,4,6,7). */
export const rescale5to7 = (x: number) => Math.round(1 + (x - 1) * 1.5);

export type InteractionKind = "email" | "meeting" | "manual" | "call";
export type InteractionSource = "gmail" | "calendar" | "manual" | "mcp" | "import";

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  photo_url: string | null;
  company: string | null;
  linkedin_url: string | null;
  emails: string[];
  phone: string | null;
  location: string | null;
  date_met: string | null; // YYYY-MM-DD
  type: ContactType | null;
  cadence_days_override: number | null;
  statuses: Status[];
  priority_due: string | null;
  strength: number | null; // 1-7, see STRENGTH_SCALE
  position: string | null;
  source: ContactSource;
  linkedin_connected_on: string | null;
  triaged_at: string | null; // null = waiting in the inbox
  notes: string | null;
  snoozed_until: string | null;
  last_contact_at: string | null; // ISO
  created_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  occurred_at: string;
  kind: InteractionKind;
  source: InteractionSource;
  summary: string | null;
  external_id: string | null;
}

export type CadenceSettings = Record<ContactType, number | null>;

export const DEFAULT_CADENCE: CadenceSettings = {
  red: 14,
  orange: 30,
  yellow: 90,
  green: 180,
  blue: 365,
  purple: null,
};

export const TYPE_META: Record<ContactType, { label: string; hex: string; blurb: string }> = {
  red: { label: "Red", hex: "#E5484D", blurb: "Every 2 weeks" },
  orange: { label: "Orange", hex: "#F76B15", blurb: "Monthly" },
  yellow: { label: "Yellow", hex: "#E2A336", blurb: "Quarterly" },
  green: { label: "Green", hex: "#30A46C", blurb: "Every 6 months" },
  blue: { label: "Blue", hex: "#0090FF", blurb: "Yearly" },
  purple: { label: "Purple", hex: "#8E4EC6", blurb: "When relevant" },
};

export type ContactInput = Partial<Omit<Contact, "id" | "user_id" | "created_at" | "last_contact_at">> & {
  name: string;
};
