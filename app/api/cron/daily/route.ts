import { NextRequest, NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { SupabaseRepo } from "@/lib/repo";
import { syncGoogle } from "@/lib/google";
import { digestText, dueList } from "@/lib/cadence";
import { pushToUser } from "@/lib/push";

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
      const msg = digestText(dueList(contacts, new Date(), { ...u.cadence }));
      if (msg) r.pushed = await pushToUser(admin, u.user_id, { ...msg, url: "/" });
      await admin.from("user_settings").update({ last_digest_date: localDate }).eq("user_id", u.user_id);
    }
    report.push(r);
  }
  return NextResponse.json({ ok: true, report });
}
