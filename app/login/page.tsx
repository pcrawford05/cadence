"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function LoginPage() {
  const [err, setErr] = useState("");
  async function signIn() {
    const db = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
    if (error) setErr(error.message);
  }
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center text-center">
      <div className="mb-6 flex -space-x-3">
        {["#E5484D", "#F76B15", "#E2A336", "#30A46C", "#0090FF"].map((c) => (
          <span key={c} className="h-12 w-12 rounded-full border-4 border-paper" style={{ background: c }} />
        ))}
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Cadence</h1>
      <p className="mt-2 text-muted">Keep up with the people who matter.</p>
      <button onClick={signIn} className="btn-primary mt-8 w-full py-2.5">Continue with Google</button>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <p className="mt-6 text-xs text-muted">Invite only. Ask the owner to add your email.</p>
    </div>
  );
}
