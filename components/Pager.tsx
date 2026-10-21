import Link from "next/link";

/** Page window like: 1 … 4 5 [6] 7 8 … 12 */
function windowed(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

export function paginate<T>(items: T[], pageParam: string | undefined, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Number(pageParam) || 1));
  const start = (page - 1) * size;
  return { page, pages, start, slice: items.slice(start, start + size), total: items.length };
}

export default function Pager({ page, pages, start, shown, total, href }: {
  page: number; pages: number; start: number; shown: number; total: number; href: (p: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted">Showing {start + 1} to {start + shown} of {total}</p>
      <div className="flex items-center gap-1">
        {page > 1 ? <Link href={href(page - 1)} className="btn-ghost" data-pager="prev">← Prev</Link> : <span className="btn-ghost opacity-40">← Prev</span>}
        <span className="hidden gap-1 sm:flex">
          {windowed(page, pages).map((p, i) =>
            p === "…" ? <span key={`e${i}`} className="px-1 text-muted">…</span> : (
              <Link key={p} href={href(p)} aria-current={p === page ? "page" : undefined}
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm tabular-nums ${p === page ? "bg-ink text-paper" : "text-muted hover:bg-card hover:text-ink"}`}>{p}</Link>
            ),
          )}
        </span>
        <span className="px-2 text-sm tabular-nums text-muted sm:hidden">{page} / {pages}</span>
        {page < pages ? <Link href={href(page + 1)} className="btn-ghost" data-pager="next">Next →</Link> : <span className="btn-ghost opacity-40">Next →</span>}
      </div>
    </nav>
  );
}
