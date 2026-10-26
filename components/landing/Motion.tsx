"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** True while the element is on screen. Stories use it so nothing runs off screen. */
export function useInView(ref: RefObject<Element | null>, threshold = 0.3) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return seen;
}

/**
 * A story clock: counts up one step every `ms` while on screen. Under Reduce Motion it holds
 * `still`, the step that shows the finished design, so the visual reads without any movement.
 */
export function useStory(ref: RefObject<Element | null>, ms: number, still = 0) {
  const visible = useInView(ref);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible || reduce) return;
    const t = setInterval(() => setStep((s) => s + 1), ms);
    return () => clearInterval(t);
  }, [visible, reduce, ms]);
  return reduce ? still : step;
}

/** Rises in once when part of it is on screen, then stays. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Large type whose words light up one at a time as they cross the lower third of the screen. */
export function Tagline({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const words = [...(ref.current?.querySelectorAll<HTMLElement>(".tl-word") ?? [])];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      words.forEach((w) => w.classList.add("is-lit"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-lit"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -35% 0px" },
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);
  return (
    <p ref={ref} className="mx-auto max-w-3xl text-balance font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-tight">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line.split(" ").map((w, j) => <span key={j} className="tl-word">{w} </span>)}
        </span>
      ))}
    </p>
  );
}
