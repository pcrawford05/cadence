import { NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { currentUser } from "@/lib/session";
import { SupabaseRepo } from "@/lib/repo";
import { syncGoogle } from "@/lib/google";

export const maxDuration = 60;

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ ok: true, demo: true, emails: 3, meetings: 1, suggestions: 2 });
  const admin = adminClient();
  const { data: s } = await admin.from("user_settings").select("google_refresh_token, google_email").eq("user_id", user.id).single();
  if (!s?.google_refresh_token) return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  try {
    const r = await syncGoogle(new SupabaseRepo(admin, user.id), admin, s.google_refresh_token, s.google_email, 3);
    await admin.from("user_settings").update({ google_last_sync: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, reconnect: true }, { status: 502 });
  }
}
