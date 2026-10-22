import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { oauthClient, syncGoogle } from "@/lib/google";
import { encrypt } from "@/lib/crypto";
import { adminClient } from "@/lib/supabase";
import { currentUser } from "@/lib/session";
import { SupabaseRepo } from "@/lib/repo";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const app = process.env.APP_URL!;
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${app}/login`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("g_state")?.value) {
    return NextResponse.redirect(`${app}/settings?google=error`);
  }

  const auth = oauthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) return NextResponse.redirect(`${app}/settings?google=norefresh`);
  auth.setCredentials(tokens);
  const { data: info } = await google.oauth2({ version: "v2", auth }).userinfo.get();
  const email = info.email ?? user.email;

  const admin = adminClient();
  const enc = encrypt(tokens.refresh_token);
  await admin.from("user_settings").upsert({ user_id: user.id, google_refresh_token: enc, google_email: email });

  // Backfill the last 60 days so "last contact" is accurate from day one.
  try {
    // First connect: log history older than 3 days directly; recent activity goes to the Recap for review.
    await syncGoogle(new SupabaseRepo(admin, user.id), admin, enc, email, 60, { autoLogBefore: new Date(Date.now() - 3 * 86_400_000) });
    await admin.from("user_settings").update({ google_last_sync: new Date().toISOString() }).eq("user_id", user.id);
  } catch {
    /* the nightly job will retry */
  }
  const res = NextResponse.redirect(`${app}/settings?google=connected`);
  res.cookies.delete("g_state");
  return res;
}
