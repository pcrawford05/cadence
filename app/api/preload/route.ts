import { NextResponse } from "next/server";
import { getRepoOrNull } from "@/lib/session";

/**
 * Signed photo URLs for everyone with a photo. The launch screen downloads these into the
 * browser cache; pages later get the SAME URLs (signing is reused for hours), so avatars are instant.
 */
export async function GET() {
  const repo = await getRepoOrNull();
  if (!repo) return NextResponse.json({ urls: [] });
  const withPhoto = (await repo.listContactsBare()).filter((c) => c.photo_url);
  const signed = await repo.withPhotos(withPhoto.slice(0, 400));
  return NextResponse.json({ urls: signed.map((c) => c.photo_url).filter(Boolean) }, { headers: { "cache-control": "private, no-store" } });
}
