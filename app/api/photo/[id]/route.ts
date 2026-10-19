import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { getRepoOrNull } from "@/lib/session";
import { SupabaseRepo } from "@/lib/repo";

/** Serves a private photo via a short-lived signed URL, only to its owner. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepoOrNull();
  if (!(repo instanceof SupabaseRepo)) return new NextResponse(null, { status: 404 });
  const path = await repo.photoPath(id);
  if (!path) return new NextResponse(null, { status: 404 });
  const db = await serverClient();
  const { data } = await db.storage.from("photos").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "cache-control": "private, max-age=3000" } });
}
