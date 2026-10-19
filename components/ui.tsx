import Link from "next/link";
import { Contact, ContactType, Status, TYPE_META } from "@/lib/types";

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function Avatar({ c, size = 64 }: { c: Pick<Contact, "name" | "photo_url" | "type">; size?: number }) {
  const ring = c.type ? TYPE_META[c.type].hex : "rgb(var(--line))";
  const ringW = size >= 96 ? 4 : 3;
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{ width: size, height: size, padding: ringW, background: ring }}
      title={c.type ? `${TYPE_META[c.type].label}: ${TYPE_META[c.type].blurb}` : "No type"}
    >
      <div className="h-full w-full overflow-hidden rounded-full border-2 border-card bg-card">
        {c.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-display font-semibold text-white"
            style={{ background: ring, fontSize: size * 0.34 }}
          >
            {initials(c.name)}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  priority: "bg-red-500/10 text-red-600 dark:text-red-400",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  nurture: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  dormant: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  new: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function StatusPills({ statuses }: { statuses: Status[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((s) => (
        <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[s]}`}>{s}</span>
      ))}
    </div>
  );
}

export function TypeDot({ type }: { type: ContactType | null }) {
  if (!type) return <span className="text-muted">None</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_META[type].hex }} />
      {TYPE_META[type].label}
    </span>
  );
}

export function relDays(n: number | null) {
  if (n == null) return "Not scheduled";
  if (n === 0) return "Due today";
  if (n > 0) return `${n} day${n === 1 ? "" : "s"} overdue`;
  return `Due in ${-n} day${n === -1 ? "" : "s"}`;
}

export function sinceText(iso: string | null) {
  if (!iso) return "Never logged";
  const d = Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
  if (d <= 0) return "Talked today";
  if (d < 45) return `Talked ${d}d ago`;
  if (d < 365) return `Talked ${Math.round(d / 30)}mo ago`;
  return `Talked ${(d / 365).toFixed(1)}y ago`;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function ContactLink({ c, children, className }: { c: { id: string }; children: React.ReactNode; className?: string }) {
  return <Link href={`/contacts/${c.id}`} className={className}>{children}</Link>;
}
