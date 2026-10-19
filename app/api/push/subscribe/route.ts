import { NextRequest, NextResponse } from "next/server";
import { isDemo, serverClient } from "@/lib/supabase";
import { currentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sub = await req.json();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  if (isDemo()) return NextResponse.json({ ok: true, demo: true });
  const db = await serverClient();
  const { error } = await db.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
