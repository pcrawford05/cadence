import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const db = await serverClient();
  await db.auth.signOut();
  return NextResponse.redirect(`${req.nextUrl.origin}/`, { status: 303 });
}
