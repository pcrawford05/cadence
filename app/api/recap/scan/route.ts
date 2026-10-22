import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRecap, getRepo } from "@/lib/session";
import { adminClient, isDemo } from "@/lib/supabase";

export const maxDuration = 60;

/**
 * Recap scan, in two steps so the page can show real progress and never holds the router.
 * (A server action would queue every navigation behind Gemini; a plain fetch does not.)
 *   POST ?step=sync   pull the last 3 days of Calendar and sent Gmail into signals
 *   POST ?step=draft  turn pending signals into proposals with Gemini
 */
export async function POST(req: Request) {
  const step = new URL(req.url).searchParams.get("step");
  try {
    const repo = await getRepo();
    if (step === "sync") {
      if (isDemo()) { await new Promise((r) => setTimeout(r, 600)); return NextResponse.json({ ok: true, connected: true }); }
      const admin = adminClient();
      const { data: s } = await admin.from("user_settings").select("google_refresh_token, google_email").eq("user_id", repo.userId).single();
      if (!s?.google_refresh_token) return NextResponse.json({ ok: true, connected: false });
      const { syncGoogle } = await import("@/lib/google");
      const { SupabaseRepo } = await import("@/lib/repo");
      await syncGoogle(new SupabaseRepo(admin, repo.userId), admin, s.google_refresh_token, s.google_email, 3);
      await admin.from("user_settings").update({ google_last_sync: new Date().toISOString() }).eq("user_id", repo.userId);
      return NextResponse.json({ ok: true, connected: true });
    }
    if (step === "draft") {
      const [store, settings] = await Promise.all([getRecap(), repo.getSettings()]);
      const { generateFromSignals } = await import("@/lib/recap");
      const added = await generateFromSignals(store, repo, settings.timezone);
      revalidatePath("/recap");
      return NextResponse.json({ ok: true, added });
    }
    return NextResponse.json({ ok: false, error: "Unknown step" }, { status: 400 });
  } catch (e) {
    const m = (e as Error).message;
    return NextResponse.json({ ok: false, error: m.includes("invalid_grant") ? "Google access expired. Reconnect in Settings." : m }, { status: 200 });
  }
}
