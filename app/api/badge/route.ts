import { NextResponse } from "next/server";
import { getRecap, getRepoOrNull } from "@/lib/session";
import { badgeCounts } from "@/lib/badge";

export async function GET() {
  const repo = await getRepoOrNull();
  if (!repo) return NextResponse.json({ inbox: 0, recap: 0, reminders: 0, total: 0 });
  try { return NextResponse.json(await badgeCounts(repo, await getRecap())); }
  catch { return NextResponse.json({ inbox: 0, recap: 0, reminders: 0, total: 0 }); }
}
