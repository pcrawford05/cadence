import { NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { currentUser } from "@/lib/session";
import { newToken, sha256 } from "@/lib/crypto";

/** Creates (or rotates) the user's agent token. The plain token is shown once; only its hash is stored. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = newToken();
  if (!isDemo()) {
    const { error } = await adminClient().from("user_settings").upsert({ user_id: user.id, mcp_token_hash: sha256(token) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ token });
}
