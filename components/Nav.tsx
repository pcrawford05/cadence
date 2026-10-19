"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Due", icon: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/inbox", label: "Inbox", icon: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" },
  { href: "/people", label: "People", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74" },
  { href: "/table", label: "Table", icon: "M3 5h18M3 12h18M3 19h18M9 5v14" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <header className="sticky top-0 z-20 hidden border-b border-line bg-paper/85 backdrop-blur sm:block">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">Cadence</Link>
          <nav className="flex gap-1">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className={`rounded-full px-3 py-1.5 text-sm ${active(i.href) ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
                {i.label}
              </Link>
            ))}
          </nav>
          <Link href="/contacts/new" className="btn-primary ml-auto">+ Add person</Link>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-5">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(i.href) ? "text-ink" : "text-muted"}`}>
              <Icon d={i.icon} />
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
