"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search that updates as you type. Names and details filter on the server from the bare
 * contact list, and only the visible page signs photos, so each keystroke stays cheap.
 */
export default function PeopleSearch() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v.trim()) p.set("q", v.trim()); else p.delete("q");
    p.delete("page");
    start(() => router.replace(p.size ? `${path}?${p}` : path, { scroll: false }));
  };

  return (
    <form className="relative mb-4 max-w-md" role="search" onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); push(q); }}>
      <input
        id="people-search"
        type="search"
        value={q}
        onChange={(e) => { const v = e.target.value; setQ(v); clearTimeout(timer.current); timer.current = setTimeout(() => push(v), 180); }}
        placeholder="Search name, company, notes   ( / )"
        aria-label="Search people"
        autoComplete="off"
        className="input rounded-full px-4 pr-10"
      />
      {pending && <span aria-hidden className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />}
    </form>
  );
}
