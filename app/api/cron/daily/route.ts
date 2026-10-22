import { NextRequest, NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { SupabaseRepo } from "@/lib/repo";
import { syncGoogle } from "@/lib/google";
import { digestText, dueList, inboxBatch } from "@/lib/cadence";
import { pushToUser } from "@/lib/push";
import { SupabaseRecap, generateFromSignals } from "@/lib/recap";

export const maxDuration = 60;

/**
 * Runs daily (vercel.json) or hourly (Supabase pg_cron). Per user:
 * 1. sync Gmail + Calendar, 2. send the digest once per local day at or after digest_hour.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isDemo()) return NextResponse.json({ demo: true });

  const admin = adminClient();
  const { data: users, error } = await admin.from("user_settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report: Record<string, unknown>[] = [];
  for (const u of users ?? []) {
    const repo = new SupabaseRepo(admin, u.user_id);
    const r: Record<string, unknown> = { user: u.user_id };
    try {
      if (u.google_refresh_token && u.google_email) {
        r.sync = await syncGoogle(repo, admin, u.google_refresh_token, u.google_email);
        await admin.from("user_settings").update({ google_last_sync: new Date().toISOString() }).eq("user_id", u.user_id);
      }
    } catch (e) {
      r.syncError = (e as Error).message; // e.g. expired refresh token: user must reconnect
    }

    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: u.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    const localDate = `${get("year")}-${get("month")}-${get("day")}`;
    const localHour = Number(get("hour"));

    if (u.last_digest_date !== localDate && localHour >= u.digest_hour) {
      const contacts = await repo.listContacts();
      const inbox = inboxBatch(contacts, new Date(), u.inbox_daily ?? 5, u.timezone);
      const msg = digestText(dueList(contacts, new Date(), { ...u.cadence }), Math.min(inbox.leftToday, inbox.remaining));
      if (msg) r.pushed = await pushToUser(admin, u.user_id, { ...msg, url: msg.title.includes("to sort") ? "/inbox" : "/" });
      await admin.from("user_settings").update({ last_digest_date: localDate }).eq("user_id", u.user_id);

      // Every 3 days: draft the recap ahead of time, then ask who they met.
      const lastRecap = u.last_recap_at ? Date.parse(u.last_recap_at) : 0;
      if (Date.now() - lastRecap > 2.5 * 86_400_000) {
        let found = 0;
        try { found = await generateFromSignals(new SupabaseRecap(admin, u.user_id), repo, u.timezone); } catch (e) { r.recapError = (e as Error).message; }
        r.recapPushed = await pushToUser(admin, u.user_id, {
          title: "Who did you meet in the last 3 days?",
          body: found ? `Found ${found} ${found === 1 ? "conversation" : "conversations"} in your calendar and email. Add anyone else you talked to.` : "Log coffee chats, calls, and texts in about a minute.",
          url: "/recap",
          tag: "cadence-recap",
        });
        await admin.from("user_settings").update({ last_recap_at: new Date().toISOString() }).eq("user_id", u.user_id);
      }
    }
    report.push(r);
  }
  return NextResponse.json({ ok: true, report });
}
