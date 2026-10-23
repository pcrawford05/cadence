"use client";
import { useLayoutEffect, useRef } from "react";

/** Horizontal chip strip on phones; keeps the selected chip in view after a filter reloads the page. */
export default function ChipRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current, on = el?.querySelector<HTMLElement>("[data-on=true]");
    if (el && on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2;
  });
  return <div ref={ref} className={`chip-row -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}>{children}</div>;
}
