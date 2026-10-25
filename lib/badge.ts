import type { Repo } from "./repo";
import type { RecapStore } from "./recap";
import { inboxBatch, localDate } from "./cadence";

export interface BadgeCounts { inbox: number; recap: number; reminders: number; total: number }

/** What the red badge counts: people left to sort today, conversations to log, and unchecked reminders. */
export async function badgeCounts(repo: Repo, recap: RecapStore): Promise<BadgeCounts> {
  const [contacts, s, proposals] = await Promise.all([repo.listContactsBare(), repo.getSettings(), recap.listProposals()]);
  const info = inboxBatch(contacts, new Date(), s.inbox_daily, s.timezone);
  const today = localDate(new Date(), s.timezone);
  const inbox = Math.min(info.leftToday, info.remaining);
  const recapN = proposals.filter((p) => p.status === "pending").length;
  const reminders = s.reminders.filter((r) => r.text.trim() && r.done_on !== today).length;
  return { inbox, recap: recapN, reminders, total: inbox + recapN + reminders };
}
