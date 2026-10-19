import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = req.nextUrl.origin;
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  const msg = req.nextUrl.searchParams.get("error_description") ?? "Sign in failed";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
}
