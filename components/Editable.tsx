"use client";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateField, type EditableField } from "@/app/actions";
import { STATUSES, STRENGTH_SCALE, TYPES, TYPE_META, type ContactType, type Status } from "@/lib/types";

/** Fields whose change alters computed values (due date, status hints) on the page. */
const DERIVED: EditableField[] = ["type", "statuses", "cadence_days_override", "priority_due", "date_met"];

type SaveState = "idle" | "saving" | "saved" | "error";
const Ctx = createContext<{ id: string }>({ id: "" });
export const EditableProvider = ({ id, children }: { id: string; children: React.ReactNode }) => <Ctx.Provider value={{ id }}>{children}</Ctx.Provider>;

function useSave(field: EditableField) {
  const { id } = useContext(Ctx);
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function save(value: unknown, onSaved?: (v: unknown) => void) {
    setState("saving");
    start(async () => {
      const r = await updateField(id, field, value);
      if (!r.ok) { setState("error"); setError(r.error); return; }
      setError("");
      setState("saved");
      onSaved?.(r.value);
      if (DERIVED.includes(field)) router.refresh();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 1600);
    });
  }
  return { state, error, save };
}

function Status({ state, error }: { state: SaveState; error: string }) {
  if (state === "saving") return <span className="text-[11px] text-muted">Saving…</span>;
  if (state === "saved") return <span className="text-[11px] text-accent">✓ Saved</span>;
  if (state === "error") return <span className="text-[11px] text-red-600">{error}</span>;
  return null;
}

function fmt(v: string, f?: "date" | "days") {
  if (f === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (f === "days") return `Every ${v} days`;
  return v;
}

/** Click to edit text; saves on blur or Enter; Escape cancels. */
export function EditText({
  field, value, label, placeholder = "Add", multiline = false, type = "text", className = "", inputClassName = "", format,
}: {
  field: EditableField; value: string | null; label?: string; placeholder?: string; multiline?: boolean;
  type?: "text" | "date" | "number" | "url" | "tel" | "email"; className?: string; inputClassName?: string; format?: "date" | "days";
}) {
  const { state, error, save } = useSave(field);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [shown, setShown] = useState(value ?? "");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); if (type === "text" || multiline) ref.current?.select(); } }, [editing, type, multiline]);
  useEffect(() => { if (!editing) { setVal(value ?? ""); setShown(value ?? ""); } }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit() {
    setEditing(false);
    if (val.trim() === shown.trim()) return;
    const prev = shown;
    setShown(val);
    save(val, (v) => {
      const s = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
      setShown(s); setVal(s);
    });
    if (field === "name" && !val.trim()) { setShown(prev); setVal(prev); }
  }

  const common = {
    ref, value: val,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setVal(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { setVal(shown); setEditing(false); }
      if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); (e.target as HTMLElement).blur(); }
    },
    "aria-label": label,
    className: `w-full rounded-lg border border-accent bg-card px-2 py-1 outline-none ${inputClassName}`,
  };

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="label !mb-0.5">{label}</span>
          <Status state={state} error={error} />
        </div>
      )}
      {editing ? (
        multiline ? <textarea {...common} rows={Math.max(3, val.split("\n").length + 1)} /> : <input {...common} type={type} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`group -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition hover:bg-paper ${inputClassName} ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
          title="Click to edit"
        >
          {shown ? fmt(shown, format) : <span className="text-muted/70">{placeholder}</span>}
          <span className="ml-1.5 text-[11px] text-muted opacity-0 transition group-hover:opacity-100">✎</span>
        </button>
      )}
      {!label && <Status state={state} error={error} />}
    </div>
  );
}

/** Type color chips; click saves immediately. Click the active one to clear. */
export function EditType({ value }: { value: ContactType | null }) {
  const { state, error, save } = useSave("type");
  const [v, setV] = useState(value);
  return (
    <div>
      <div className="flex items-center justify-between"><span className="label !mb-1">Reach out</span><Status state={state} error={error} /></div>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { const n = v === t ? null : t; setV(n); save(n); }}
            className={`chip transition ${v === t ? "!border-ink bg-paper" : "opacity-70 hover:opacity-100"}`}
            title={TYPE_META[t].label}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_META[t].hex }} />
            {TYPE_META[t].blurb}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EditStrength({ value }: { value: number | null }) {
  const { state, error, save } = useSave("strength");
  const [v, setV] = useState(value);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label !mb-1">Strength{v ? ` · ${STRENGTH_SCALE[v].label}` : ""}</span>
        <Status state={state} error={error} />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            title={`${STRENGTH_SCALE[n].label}: ${STRENGTH_SCALE[n].hint}`}
            onClick={() => { const x = v === n ? null : n; setV(x); save(x); }}
            className={`rounded-lg border py-1 text-sm font-semibold tabular-nums transition ${v === n ? "border-ink bg-ink text-paper" : v && n < v ? "border-accent/40 bg-accent/10" : "border-line bg-card hover:border-accent"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

const STATUS_ON: Record<Status, string> = {
  priority: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400",
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  nurture: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  dormant: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30 dark:text-zinc-400",
  new: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400",
};

export function EditStatuses({ value }: { value: Status[] }) {
  const { state, error, save } = useSave("statuses");
  const [v, setV] = useState<Status[]>(value);
  return (
    <div>
      <div className="flex items-center justify-between"><span className="label !mb-1">Status</span><Status state={state} error={error} /></div>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const on = v.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => { const n = on ? v.filter((x) => x !== s) : [...v, s]; setV(n); save(n); }}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition ${on ? STATUS_ON[s] : "border-line text-muted hover:text-ink"}`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
