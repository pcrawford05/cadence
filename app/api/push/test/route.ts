import { NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { currentUser, getRepoOrNull } from "@/lib/session";
import { digestText, dueList } from "@/lib/cadence";
import { pushToUser } from "@/lib/push";

/** Sends today's digest right now (ignores the once-a-day rule) so you can confirm notifications work. */
export async function POST() {
  const user = await currentUser();
  const repo = await getRepoOrNull();
  if (!user || !repo) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await repo.getSettings();
  const due = dueList(await repo.listContacts(), new Date(), s.cadence);
  const msg = digestText(due) ?? { title: "Cadence is set up", body: due.length ? `${due.length} people are overdue` : "Nobody is due today. Nice." };
  if (isDemo()) return NextResponse.json({ ok: true, demo: true, msg });
  const sent = await pushToUser(adminClient(), user.id, { ...msg, url: "/" });
  return NextResponse.json({ ok: true, sent });
}
