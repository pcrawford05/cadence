import type { Metadata } from "next";
import { Mark } from "@/components/landing/Stories";

export const metadata: Metadata = { title: "Privacy · Cadence" };

/** Public privacy policy, linked from the Google consent screen and the landing footer. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <a href="/welcome" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
        <Mark className="h-7 w-7" /> Cadence
      </a>
      <h1 className="mt-10 font-display text-4xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated October 27, 2026</p>
      <div className="mt-8 space-y-6 text-pretty [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1.5 [&_p]:text-muted">
        <section>
          <h2>What Cadence is</h2>
          <p>Cadence is a personal networking CRM run by Peyton Crawford for a small, invited group. It is not sold and shows no ads.</p>
        </section>
        <section>
          <h2>What it stores</h2>
          <p>The people you add (names, photos, notes, contact details) and the conversations you log. Each account is private: no other user can see your data.</p>
        </section>
        <section>
          <h2>Google data</h2>
          <p>If you connect Google, Cadence reads Calendar events and the headers of mail you sent (who, when, subject). It never reads message bodies. This is used only to suggest conversations for you to log in Recap. Cadence does not sell, share or use Google data for ads, and its use follows the Google API Services User Data Policy, including the Limited Use requirements.</p>
        </section>
        <section>
          <h2>AI</h2>
          <p>To draft Recap suggestions, event titles, email subjects and participant names are sent to Google's Gemini API. Cadence uses Gemini's free tier, where Google may use these inputs to improve its products. Message bodies are never sent.</p>
        </section>
        <section>
          <h2>Where it lives</h2>
          <p>Data is stored in Supabase (Postgres with per-user access rules) and the app runs on Vercel. Google sign-in tokens are encrypted at rest.</p>
        </section>
        <section>
          <h2>Removing your data</h2>
          <p>Disconnect Google in Settings at any time, or revoke access at myaccount.google.com/permissions. To delete your account and everything in it, email pcrawfor@usc.edu.</p>
        </section>
      </div>
    </main>
  );
}
