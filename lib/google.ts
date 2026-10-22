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

export interface SyncResult { emails: number; meetings: number; suggestions: number; signals: number }

export interface SignalRow {
  source: "gmail" | "calendar";
  external_id: string;
  occurred_at: string;
  title: string | null;
  detail: string | null;
  participants: { email: string | null; name: string | null }[];
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Pull the last `days` of Gmail headers and Calendar events and store them as signals for the AI recap.
 * Nothing is logged automatically, except history older than `autoLogBefore` (used for the first-connect
 * backfill), which is logged directly for people already in Cadence.
 * Email counts only when the thread is two-way (both you and they wrote in it).
 */
export async function syncGoogle(
  repo: Repo, admin: SupabaseClient, encryptedRefresh: string, selfEmail: string, days = 3,
  opts: { autoLogBefore?: Date } = {},
): Promise<SyncResult> {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: decrypt(encryptedRefresh) });
  const gmail = google.gmail({ version: "v1", auth });
  const cal = google.calendar({ version: "v3", auth });
  const me = selfEmail.toLowerCase();
  const cutoff = opts.autoLogBefore?.toISOString() ?? null;

  const contacts = await repo.listContactsBare();
  const byEmail = new Map<string, string>();
  contacts.forEach((c) => c.emails.forEach((e) => byEmail.set(e.toLowerCase(), c.id)));

  const res: SyncResult = { emails: 0, meetings: 0, suggestions: 0, signals: 0 };
  const signals: SignalRow[] = [];

  // ---- Gmail: threads you wrote in recently ----
  // The headers-only scope (gmail.metadata) can't use search queries, so walk your SENT mail
  // newest-first until we pass the window. Two-way threads always contain a message you sent.
  const since = Date.now() - days * 86_400_000;
  const threadSet = new Set<string>();
  let pageToken: string | undefined;
  let scanned = 0;
  outer: do {
    const r = await gmail.users.messages.list({ userId: "me", labelIds: ["SENT"], maxResults: 100, pageToken });
    for (const m of r.data.messages ?? []) {
      if (!m.id) continue;
      const meta = await gmail.users.messages.get({ userId: "me", id: m.id, format: "minimal" });
      scanned++;
      if (Number(meta.data.internalDate ?? 0) < since) break outer;
      if (meta.data.threadId) threadSet.add(meta.data.threadId);
      if (scanned >= 400) break outer;
    }
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  const threads = [...threadSet];

  for (const id of threads) {
    const t = await gmail.users.threads.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "To", "Cc", "Subject"] });
    const msgs = t.data.messages ?? [];
    const senders = new Set<string>();
    const names = new Map<string, string | null>();
    let lastDate = "";
    let subject = "";
    for (const m of msgs) {
      const h = Object.fromEntries((m.payload?.headers ?? []).map((x) => [x.name!.toLowerCase(), x.value ?? ""]));
      const from = addr(h.from ?? "");
      senders.add(from);
      names.set(from, nameOf(h.from ?? ""));
      if (!subject && h.subject) subject = h.subject;
      const d = m.internalDate ? new Date(Number(m.internalDate)).toISOString() : "";
      if (d > lastDate) lastDate = d;
    }
    if (!senders.has(me) || !lastDate) continue;
    const others = [...senders].filter((e) => e !== me && !/no-?reply|notifications?@|mailer|calendar-notification/.test(e));
    if (!others.length) continue;

    if (cutoff && lastDate < cutoff) {
      for (const e of others) {
        const cid = byEmail.get(e);
        if (cid && (await repo.logInteraction({ contact_id: cid, occurred_at: lastDate, kind: "email", source: "gmail", external_id: `${id}:${lastDate.slice(0, 10)}`, summary: subject || "Email thread" }))) res.emails++;
      }
      continue;
    }
    signals.push({
      source: "gmail", external_id: `${id}:${lastDate.slice(0, 10)}`, occurred_at: lastDate,
      title: subject || null, detail: `${msgs.length} message thread`,
      participants: others.map((e) => ({ email: e, name: names.get(e) ?? null })),
    });
  }

  // ---- Calendar: events that ended in the window (with guests, or solo entries like "Coffee w/ Sarah") ----
  const timeMin = new Date(Date.now() - days * 86_400_000).toISOString();
  const ev = await cal.events.list({ calendarId: "primary", timeMin, timeMax: new Date().toISOString(), singleEvents: true, maxResults: 250 });
  for (const e of ev.data.items ?? []) {
    if (!e.id || !e.end?.dateTime || !e.start?.dateTime) continue; // skip all-day blocks
    const hours = (Date.parse(e.end.dateTime) - Date.parse(e.start.dateTime)) / 3.6e6;
    if (hours > 4) continue;
    const atts = e.attendees ?? [];
    if (atts.length > MAX_ATTENDEES) continue;
    if (atts.find((a) => a.self)?.responseStatus === "declined") continue;
    const guests = atts.filter((a) => !a.self && a.responseStatus !== "declined" && !a.resource);
    if (!guests.length && !e.summary) continue;
    const end = new Date(e.end.dateTime).toISOString();

    if (cutoff && end < cutoff) {
      for (const a of guests) {
        const cid = a.email ? byEmail.get(a.email.toLowerCase()) : undefined;
        if (cid && (await repo.logInteraction({ contact_id: cid, occurred_at: end, kind: "meeting", source: "calendar", external_id: e.id, summary: e.summary ?? "Meeting" }))) res.meetings++;
      }
      continue;
    }
    signals.push({
      source: "calendar", external_id: e.id, occurred_at: end, title: e.summary ?? null,
      detail: [e.location, e.description ? stripHtml(e.description).slice(0, 400) : null].filter(Boolean).join(" · ") || null,
      participants: guests.map((a) => ({ email: a.email?.toLowerCase() ?? null, name: a.displayName ?? null })),
    });
  }

  // ---- Store signals for the recap (dedupe on external_id; never re-open processed ones) ----
  if (signals.length) {
    const rows = signals.map((s) => ({ ...s, user_id: repo.userId }));
    const { error, count } = await admin.from("signals").upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;
    res.signals = count ?? rows.length;
  }
  return res;
}
