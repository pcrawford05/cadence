"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

/** Google sign-in. In demo mode there is no Supabase, so it opens the demo app instead. */
export default function SignIn({ error, className = "" }: { error?: string; className?: string }) {
  const [err, setErr] = useState(error ?? "");
  const [busy, setBusy] = useState(false);
  async function signIn() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { location.href = "/"; return; }
    setBusy(true);
    const db = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
    if (error) { setErr(`Sign in failed: ${error.message}. Try again.`); setBusy(false); }
  }
  return (
    <div className={className}>
      <button onClick={signIn} disabled={busy} className="btn-primary h-12 px-6 text-base font-semibold">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.6-2.8Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
        {busy ? "Opening Google" : "Continue with Google"}
      </button>
      {err && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
