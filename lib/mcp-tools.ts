import { z } from "zod";
import type { Repo } from "./repo";
import { computeDue, dayToISO, dueList, toDay } from "./cadence";
import { STATUSES, TYPES } from "./types";

type Tool = {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  run: (repo: Repo, args: Record<string, unknown>) => Promise<unknown>;
};

const brief = (c: Awaited<ReturnType<Repo["listContacts"]>>[number], due?: ReturnType<typeof computeDue>) => ({
  id: c.id, name: c.name, company: c.company, location: c.location, type: c.type, statuses: c.statuses,
  last_contact: c.last_contact_at?.slice(0, 10) ?? null, next_due: due?.nextDue ?? null, days_overdue: due?.daysOverdue ?? null,
  emails: c.emails, linkedin: c.linkedin_url,
});

async function findOne(repo: Repo, ref: string) {
  const all = await repo.listContacts();
  const exact = all.find((c) => c.id === ref) ?? all.find((c) => c.name.toLowerCase() === ref.toLowerCase());
  if (exact) return exact;
  const partial = all.filter((c) => c.name.toLowerCase().includes(ref.toLowerCase()));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new Error(`"${ref}" matches ${partial.map((c) => c.name).join(", ")}. Use the id.`);
  throw new Error(`No contact matches "${ref}"`);
}

export const TOOLS: Tool[] = [
  {
    name: "list_due",
    description: "People the user should reach out to now (overdue or due today), most overdue first. Set within_days to include upcoming.",
    schema: z.object({ within_days: z.number().int().min(0).max(60).optional() }),
    async run(repo, a) {
      const s = await repo.getSettings();
      return dueList(await repo.listContacts(), new Date(), s.cadence, (a.within_days as number) ?? 0).map((x) => brief(x.contact, x.due));
    },
  },
  {
    name: "search_contacts",
    description: "Search contacts by text (name, company, location, notes), type color, or status.",
    schema: z.object({ query: z.string().optional(), type: z.enum(TYPES).optional(), status: z.enum(STATUSES).optional(), limit: z.number().int().max(100).optional() }),
    async run(repo, a) {
      const s = await repo.getSettings();
      const q = ((a.query as string) ?? "").toLowerCase();
      return (await repo.listContacts())
        .filter((c) => !a.type || c.type === a.type)
        .filter((c) => !a.status || c.statuses.includes(a.status as never))
        .filter((c) => !q || [c.name, c.company, c.location, c.notes].some((v) => v?.toLowerCase().includes(q)))
        .slice(0, (a.limit as number) ?? 25)
        .map((c) => brief(c, computeDue(c, new Date(), s.cadence)));
    },
  },
  {
    name: "get_contact",
    description: "Full record for one contact (by id or name) including notes and recent interaction timeline.",
    schema: z.object({ contact: z.string() }),
    async run(repo, a) {
      const c = await findOne(repo, a.contact as string);
      const s = await repo.getSettings();
      const timeline = (await repo.listInteractions(c.id)).slice(0, 20).map((i) => ({ date: i.occurred_at.slice(0, 10), kind: i.kind, source: i.source, summary: i.summary }));
      return { ...brief(c, computeDue(c, new Date(), s.cadence)), notes: c.notes, date_met: c.date_met, priority_due: c.priority_due, timeline };
    },
  },
  {
    name: "log_interaction",
    description: "Record that the user talked with someone (coffee chat, call, etc). Resets their cadence clock.",
    schema: z.object({ contact: z.string(), date: z.string().optional().describe("YYYY-MM-DD, default today"), kind: z.enum(["meeting", "call", "manual"]).optional(), summary: z.string().optional() }),
    async run(repo, a) {
      const c = await findOne(repo, a.contact as string);
      const date = (a.date as string) ?? new Date().toISOString().slice(0, 10);
      await repo.logInteraction({ contact_id: c.id, occurred_at: `${date}T12:00:00Z`, kind: (a.kind as "meeting") ?? "meeting", source: "mcp", summary: (a.summary as string) ?? null });
      await repo.updateContact(c.id, { snoozed_until: null });
      return { ok: true, contact: c.name, date };
    },
  },
  {
    name: "update_contact",
    description: "Change a contact's type, statuses, notes, company, location, emails, or priority deadline.",
    schema: z.object({
      contact: z.string(),
      type: z.enum(TYPES).nullable().optional(),
      statuses: z.array(z.enum(STATUSES)).optional(),
      notes: z.string().optional(),
      append_note: z.string().optional(),
      company: z.string().optional(),
      location: z.string().optional(),
      emails: z.array(z.string()).optional(),
      priority_due: z.string().nullable().optional(),
    }),
    async run(repo, a) {
      const c = await findOne(repo, a.contact as string);
      const { contact: _c, append_note, ...patch } = a;
      if (append_note) patch.notes = [c.notes, append_note].filter(Boolean).join("\n");
      const u = await repo.updateContact(c.id, patch);
      return { ok: true, contact: brief(u) };
    },
  },
  {
    name: "snooze",
    description: "Defer a contact's reminder by N days.",
    schema: z.object({ contact: z.string(), days: z.number().int().min(1).max(365) }),
    async run(repo, a) {
      const c = await findOne(repo, a.contact as string);
      const until = dayToISO(toDay(new Date()) + (a.days as number));
      await repo.updateContact(c.id, { snoozed_until: until });
      return { ok: true, contact: c.name, snoozed_until: until };
    },
  },
  {
    name: "add_contact",
    description: "Create a new contact.",
    schema: z.object({ name: z.string(), company: z.string().optional(), location: z.string().optional(), emails: z.array(z.string()).optional(), linkedin_url: z.string().optional(), type: z.enum(TYPES).optional(), notes: z.string().optional(), met_today: z.boolean().optional() }),
    async run(repo, a) {
      const { met_today, ...input } = a as { name: string; met_today?: boolean };
      const c = await repo.createContact({ ...input, statuses: ["new"], date_met: met_today ? new Date().toISOString().slice(0, 10) : null });
      if (met_today) await repo.logInteraction({ contact_id: c.id, kind: "meeting", source: "mcp", summary: "Met" });
      return { ok: true, id: c.id, name: c.name };
    },
  },
];

export function toolList() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema) }));
}

export async function callTool(repo: Repo, name: string, args: unknown) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`Unknown tool ${name}`);
  const parsed = t.schema.parse(args ?? {});
  return t.run(repo, parsed as Record<string, unknown>);
}
