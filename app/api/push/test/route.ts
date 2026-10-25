import { NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { currentUser, getRepoOrNull } from "@/lib/session";
import { digestText, dueList, inboxBatch } from "@/lib/cadence";
import { pushToUser } from "@/lib/push";
import { badgeCounts } from "@/lib/badge";
import { getRecap } from "@/lib/session";

/** Sends today's digest right now (ignores the once-a-day rule) so you can confirm notifications work. */
export async function POST() {
  const user = await currentUser();
  const repo = await getRepoOrNull();
  if (!user || !repo) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await repo.getSettings();
  const all = await repo.listContacts();
  const due = dueList(all, new Date(), s.cadence);
  const ib = inboxBatch(all, new Date(), s.inbox_daily, s.timezone);
  const msg = digestText(due, Math.min(ib.leftToday, ib.remaining)) ?? { title: "Cadence is set up", body: due.length ? `${due.length} people are overdue` : "Nobody is due today. Nice." };
  if (isDemo()) return NextResponse.json({ ok: true, demo: true, msg });
  const badge = (await badgeCounts(repo, await getRecap()).catch(() => null))?.total;
  const sent = await pushToUser(adminClient(), user.id, { ...msg, body: badge ? `${msg.body} (${badge} on your badge)` : msg.body, url: "/", badge });
  return NextResponse.json({ ok: true, sent, badge });
}
