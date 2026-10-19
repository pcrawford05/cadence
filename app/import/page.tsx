"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { mapRows, parseCSV, ImportRow } from "@/lib/csv";
import { importContacts, importLinkedIn } from "@/app/actions";
import { isLinkedInExport, parseLinkedInConnections } from "@/lib/linkedin";
import { TYPE_META } from "@/lib/types";

export default function ImportPage() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [li, setLi] = useState<{ text: string; count: number } | null>(null);
  const [liDone, setLiDone] = useState<{ found: number; created: number; updated: number; unchanged: number } | null>(null);

  async function onFile(f: File) {
    setDone(null);
    setLiDone(null);
    const text = await f.text();
    if (isLinkedInExport(text)) {
      setRows(null);
      setLi({ text, count: parseLinkedInConnections(text).length });
      return;
    }
    setLi(null);
    setRows(mapRows(parseCSV(text)));
  }

  const warnings = rows?.filter((r) => r.warnings.length).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Import contacts</h1>
      <p className="mt-2 text-sm text-muted">
        Upload your LinkedIn <b>Connections.csv</b> or a spreadsheet CSV; the format is detected automatically. For spreadsheets, columns are matched by header: Name, Company, LinkedIn, Email, Phone, Location,
        Date Met, Last Contact Date, Type, Status, Notes. Notes like &quot;LinkedIn relationship level: 3/5&quot; and &quot;By end of July&quot; are parsed automatically.
      </p>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line bg-card px-6 py-12 text-center hover:border-accent">
        <span className="font-medium">Choose a CSV file</span>
        <span className="text-sm text-muted">Nothing is saved until you confirm</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {li && (
        <div className="mt-6 rounded-3xl border border-line bg-card p-5">
          <p className="font-medium">LinkedIn export detected: {li.count} connections</p>
          <p className="mt-1 text-sm text-muted">People already in Cadence are matched by profile URL, email, or name, and only blank fields are filled. Everyone new goes to your Inbox to sort a few per day.</p>
          {liDone ? (
            <p className="mt-4 rounded-xl bg-accent/10 p-3 text-sm text-accent">
              Added {liDone.created} to your inbox, updated {liDone.updated}, {liDone.unchanged} already up to date. <Link href="/inbox" className="underline">Open inbox</Link>
            </p>
          ) : (
            <button className="btn-primary mt-4" disabled={pending} onClick={() => start(async () => setLiDone(await importLinkedIn(li.text)))}>
              {pending ? "Importing..." : `Import ${li.count} connections`}
            </button>
          )}
        </div>
      )}

      {rows && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm"><b>{rows.length}</b> people found{warnings ? `, ${warnings} with notes to review` : ""}</p>
            <button
              className="btn-primary"
              disabled={pending || rows.length === 0 || done != null}
              onClick={() => start(async () => setDone(await importContacts(rows)))}
            >
              {pending ? "Importing..." : `Import ${rows.length}`}
            </button>
          </div>
          {done != null && (
            <p className="mb-3 rounded-xl bg-accent/10 p-3 text-sm text-accent">
              Imported {done} people. <Link href="/people" className="underline">View them</Link>
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase text-muted">
                <tr><th className="p-2.5">Name</th><th className="p-2.5">Type</th><th className="p-2.5">Status</th><th className="p-2.5">Last contact</th><th className="p-2.5">Notes</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="p-2.5 font-medium">{r.contact.name}</td>
                    <td className="p-2.5">{r.contact.type ? <span style={{ color: TYPE_META[r.contact.type].hex }}>{TYPE_META[r.contact.type].label}</span> : <span className="text-muted">None</span>}</td>
                    <td className="p-2.5 capitalize">{r.contact.statuses?.join(", ")}</td>
                    <td className="p-2.5 tabular-nums">{r.lastContact ?? <span className="text-muted">None</span>}</td>
                    <td className="p-2.5 text-xs text-amber-700 dark:text-amber-400">{r.warnings.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
