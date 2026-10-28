import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRecap, getRepo } from "@/lib/session";
import { adminClient, isDemo } from "@/lib/supabase";

export const maxDuration = 60;

/** Pending proposals, for the badge on the Recap tab. */
export async function GET() {
  try {
    const store = await getRecap();
    const n = (await store.listProposals()).filter((p) => p.status === "pending").length;
    return NextResponse.json({ pending: n });
  } catch { return NextResponse.json({ pending: 0 }); }
}

/**
 * Recap scan, in two steps so the page can show real progress and never holds the router.
 * (A server action would queue every navigation behind Gemini; a plain fetch does not.)
 *   POST ?step=sync   pull the last 3 days of Calendar and sent Gmail into signals
 *   POST ?step=draft  turn pending signals into proposals with Gemini
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const step = q.get("step");
  const force = q.get("force") === "1";
  try {
    const repo = await getRepo();
    if (step === "sync") {
      if (isDemo()) { await new Promise((r) => setTimeout(r, 600)); return NextResponse.json({ ok: true, connected: true }); }
      const admin = adminClient();
      const { data: s } = await admin.from("user_settings").select("google_refresh_token, google_email, google_last_sync").eq("user_id", repo.userId).single();
      if (!s?.google_refresh_token) return NextResponse.json({ ok: true, connected: false });
      if (!force && s.google_last_sync && Date.now() - Date.parse(s.google_last_sync) < 3_600_000) return NextResponse.json({ ok: true, connected: true, skipped: true });
      const { syncGoogle } = await import("@/lib/google");
      const { SupabaseRepo } = await import("@/lib/repo");
      await syncGoogle(new SupabaseRepo(admin, repo.userId), admin, s.google_refresh_token, s.google_email, 3);
      await admin.from("user_settings").update({ google_last_sync: new Date().toISOString() }).eq("user_id", repo.userId);
      return NextResponse.json({ ok: true, connected: true });
    }
    if (step === "draft") {
      const [store, settings] = await Promise.all([getRecap(), repo.getSettings()]);
      const { generateFromSignals } = await import("@/lib/recap");
      const { added, more } = await generateFromSignals(store, repo, settings.timezone);
      revalidatePath("/recap");
      const pending = (await store.listProposals()).filter((p) => p.status === "pending").length;
      return NextResponse.json({ ok: true, added, more, pending });
    }
    return NextResponse.json({ ok: false, error: "Unknown step" }, { status: 400 });
  } catch (e) {
    const m = (e as Error).message;
    console.error(`[recap] step=${step} failed:`, e);
    return NextResponse.json({ ok: false, error: m.includes("invalid_grant") ? "Google access expired. Reconnect in Settings." : m }, { status: 200 });
  }
}
