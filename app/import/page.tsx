"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { mapRows, parseCSV, ImportRow } from "@/lib/csv";
import { importContacts } from "@/app/actions";
import { TYPE_META } from "@/lib/types";

export default function ImportPage() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  async function onFile(f: File) {
    setDone(null);
    setRows(mapRows(parseCSV(await f.text())));
  }

  const warnings = rows?.filter((r) => r.warnings.length).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Import your spreadsheet</h1>
      <p className="mt-2 text-sm text-muted">
        In Google Sheets or Notion, export as CSV. Columns are matched by header: Name, Company, LinkedIn, Email, Phone, Location,
        Date Met, Last Contact Date, Type, Status, Notes. Notes like &quot;LinkedIn relationship level: 3/5&quot; and &quot;By end of July&quot; are parsed automatically.
      </p>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line bg-card px-6 py-12 text-center hover:border-accent">
        <span className="font-medium">Choose a CSV file</span>
        <span className="text-sm text-muted">Nothing is saved until you confirm</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

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
