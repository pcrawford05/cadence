import { NextResponse } from "next/server";
import { getRepoOrNull } from "@/lib/session";
import { computeDue } from "@/lib/cadence";

const esc = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const repo = await getRepoOrNull();
  if (!repo) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [contacts, s] = await Promise.all([repo.listContacts(), repo.getSettings()]);
  const head = ["Name", "Company", "LinkedIn", "Email", "Phone", "Location", "Date Met", "Last Contact Date", "Next Due", "Type", "Strength (1-7)", "Position", "Status", "Notes"];
  const lines = contacts.map((c) =>
    [c.name, c.company, c.linkedin_url, c.emails, c.phone, c.location, c.date_met, c.last_contact_at?.slice(0, 10),
      computeDue(c, new Date(), s.cadence).nextDue, c.type && c.type[0].toUpperCase() + c.type.slice(1), c.strength, c.position,
      c.statuses.map((x) => x[0].toUpperCase() + x.slice(1)), c.notes].map(esc).join(","),
  );
  return new NextResponse([head.join(","), ...lines].join("\n"), {
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="cadence-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
