import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { GOOGLE_SCOPES, oauthClient } from "@/lib/google";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${process.env.APP_URL}/login`);
  const state = randomBytes(16).toString("hex");
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    scope: GOOGLE_SCOPES,
    state,
    login_hint: user.email,
    include_granted_scopes: true,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
