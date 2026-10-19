import { Contact, ContactType, Interaction, Status } from "./types";

// Fictional people for demo mode and screenshots only.
const D = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const DD = (daysAgo: number) => D(daysAgo).slice(0, 10);

type Seed = [name: string, company: string | null, location: string | null, type: ContactType | null, lastDaysAgo: number | null, statuses: Status[], photo: number | null, notes?: string];

const seeds: Seed[] = [
  ["Maya Okafor", "Lattice Robotics", "SF", "red", 19, ["priority", "active"], 1, "Follow up on intro to their seed lead"],
  ["Daniel Reyes", "USC Viterbi", "LA", "orange", 41, ["nurture"], 2, "Keep in mind for career opportunities"],
  ["Priya Natarajan", "Northwind Capital", "SF", "orange", 33, ["active"], 3],
  ["Theo Lindqvist", "Brightline Labs", "LA", "yellow", 97, ["dormant", "nurture"], 4],
  ["Hannah Cho", "Sequoia Scout", "Palo Alto", "orange", 30, ["nurture"], 5],
  ["Marcus Bell", "Founder, Tidepool", "Sacramento", "red", 8, ["active"], 6],
  ["Sofia Marin", "Stanford GSB", "Palo Alto", "yellow", 64, ["nurture"], 7],
  ["Omar Haddad", "Vercel", "SF", "green", 120, ["nurture"], 8],
  ["Grace Whitfield", "USC Professor", "LA", "green", 215, ["dormant", "priority"], null, "Ask about independent study"],
  ["Ethan Brooks", "Techstars", "LA", "blue", 380, ["dormant"], 9],
  ["Lena Fischer", null, "Berlin", "purple", 200, ["nurture"], null],
  ["Jonah Kim", "Kleiner Perkins", "Menlo Park", "yellow", 88, ["nurture"], 10],
  ["Ava Patel", "Scale AI", "SF", "orange", 12, ["active"], 11],
  ["Noah Alvarez", null, "Sacramento", "blue", 150, ["nurture"], 12],
  ["Chloe Tran", "Figma", "SF", "yellow", 20, ["active"], null],
  ["Isaac Moreno", null, null, "orange", null, ["new"], null],
  ["Ruby Sato", null, "LA", "blue", null, ["new"], 13],
  ["Leo Martins", "a16z", "Menlo Park", "green", 30, ["active"], 14, "LinkedIn relationship level: 4/5"],
];

export function seedContacts(): Contact[] {
  return seeds.map(([name, company, location, type, last, statuses, photo, notes], i) => ({
    id: `c${i + 1}`,
    user_id: "demo-user",
    name,
    company,
    location,
    type,
    statuses,
    photo_url: photo ? `/demo/p${photo}.svg` : null,
    linkedin_url: `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "-")}`,
    emails: [`${name.split(" ")[0].toLowerCase()}@example.com`],
    phone: null,
    date_met: last != null ? DD(last + 200) : null,
    cadence_days_override: null,
    priority_due: statuses.includes("priority") ? DD(-3) : null,
    linkedin_strength: notes?.includes("level") ? 4 : null,
    notes: notes ?? null,
    snoozed_until: null,
    last_contact_at: last != null ? D(last) : null,
    created_at: D(400),
  }));
}

export function seedInteractions(): Interaction[] {
  const out: Interaction[] = [];
  seedContacts().forEach((c, i) => {
    if (!c.last_contact_at) return;
    const daysAgo = Math.round((Date.now() - Date.parse(c.last_contact_at)) / 86_400_000);
    const kinds: Array<[Interaction["kind"], Interaction["source"], string]> = [
      ["meeting", "calendar", "Coffee chat"],
      ["email", "gmail", "Re: Great meeting you"],
      ["manual", "manual", "Talked at demo day"],
    ];
    for (let k = 0; k < 3; k++) {
      const [kind, source, summary] = kinds[(i + k) % 3];
      out.push({
        id: `i${i}-${k}`, user_id: "demo-user", contact_id: c.id, kind, source, summary,
        occurred_at: D(daysAgo + k * 45), external_id: null,
      });
    }
  });
  return out;
}
