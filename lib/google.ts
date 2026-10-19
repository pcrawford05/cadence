import { google } from "googleapis";
import type { Repo } from "./repo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "./crypto";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "openid",
  "email",
];

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/google/callback`,
  );
}

const MAX_ATTENDEES = 8;
const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();
const nameOf = (s: string) => s.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || null;

export interface SyncResult { emails: number; meetings: number; suggestions: number }

/**
 * Pull the last `days` of Gmail headers and Calendar events, log interactions for known contacts,
 * and collect frequent unknown correspondents as suggestions.
 * Email counts only when the thread is two-way (both you and they sent a message in it).
 */
export async function syncGoogle(repo: Repo, admin: SupabaseClient, encryptedRefresh: string, selfEmail: string, days = 3): Promise<SyncResult> {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: decrypt(encryptedRefresh) });
  const gmail = google.gmail({ version: "v1", auth });
  const cal = google.calendar({ version: "v3", auth });
  const me = selfEmail.toLowerCase();

  const contacts = await repo.listContacts();
  const byEmail = new Map<string, string>();
  contacts.forEach((c) => c.emails.forEach((e) => byEmail.set(e.toLowerCase(), c.id)));

  const res: SyncResult = { emails: 0, meetings: 0, suggestions: 0 };
  const unknown = new Map<string, { name: string | null; count: number; last: string }>();

  // ---- Gmail: threads touched recently ----
  const threads: string[] = [];
  let pageToken: string | undefined;
  do {
    const r = await gmail.users.threads.list({ userId: "me", q: `newer_than:${days}d -category:promotions -category:social`, maxResults: 100, pageToken });
    r.data.threads?.forEach((t) => t.id && threads.push(t.id));
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken && threads.length < 500);

  for (const id of threads) {
    const t = await gmail.users.threads.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "To", "Cc", "Date"] });
    const msgs = t.data.messages ?? [];
    const senders = new Set<string>();
    const participants = new Map<string, string | null>();
    let lastDate = "";
    for (const m of msgs) {
      const h = Object.fromEntries((m.payload?.headers ?? []).map((x) => [x.name!.toLowerCase(), x.value ?? ""]));
      const from = addr(h.from ?? "");
      senders.add(from);
      participants.set(from, nameOf(h.from ?? ""));
      [h.to, h.cc].filter(Boolean).join(",").split(",").filter(Boolean).forEach((x) => participants.set(addr(x), nameOf(x)));
      const d = m.internalDate ? new Date(Number(m.internalDate)).toISOString() : "";
      if (d > lastDate) lastDate = d;
    }
    if (!senders.has(me)) continue; // you never wrote in this thread
    for (const [email, name] of participants) {
      if (email === me || !senders.has(email)) continue; // they must have written too
      const cid = byEmail.get(email);
      if (cid) {
        const ok = await repo.logInteraction({ contact_id: cid, occurred_at: lastDate, kind: "email", source: "gmail", external_id: `${id}:${lastDate.slice(0, 10)}`, summary: "Email thread" });
        if (ok) res.emails++;
      } else if (!/no-?reply|notifications?@|mailer/.test(email)) {
        const u = unknown.get(email) ?? { name, count: 0, last: lastDate };
        u.count++;
        if (lastDate > u.last) u.last = lastDate;
        unknown.set(email, u);
      }
    }
  }

  // ---- Calendar: events that ended in the window ----
  const timeMin = new Date(Date.now() - days * 86_400_000).toISOString();
  const ev = await cal.events.list({ calendarId: "primary", timeMin, timeMax: new Date().toISOString(), singleEvents: true, maxResults: 250 });
  for (const e of ev.data.items ?? []) {
    const atts = e.attendees ?? [];
    if (atts.length < 2 || atts.length > MAX_ATTENDEES) continue;
    const mine = atts.find((a) => a.self);
    if (mine && mine.responseStatus === "declined") continue;
    const end = e.end?.dateTime ?? e.end?.date;
    if (!end) continue;
    for (const a of atts) {
      const email = a.email?.toLowerCase();
      if (!email || a.self || a.responseStatus === "declined") continue;
      const cid = byEmail.get(email);
      if (!cid) continue;
      const ok = await repo.logInteraction({ contact_id: cid, occurred_at: new Date(end).toISOString(), kind: "meeting", source: "calendar", external_id: e.id ?? null, summary: e.summary ?? "Meeting" });
      if (ok) res.meetings++;
    }
  }

  // ---- Suggestions ----
  for (const [email, u] of unknown) {
    const { data: existing } = await admin.from("suggested_contacts").select("message_count").eq("user_id", repo.userId).eq("email", email).maybeSingle();
    await admin.from("suggested_contacts").upsert({ user_id: repo.userId, email, display_name: u.name, message_count: (existing?.message_count ?? 0) + u.count, last_seen: u.last });
    res.suggestions++;
  }
  return res;
}
