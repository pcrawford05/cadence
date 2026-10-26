import { STRENGTH_SCALE } from "@/lib/types";

/** Seven-step picker; works without JS (radio inputs). */
export function StrengthPicker({ name = "strength", value }: { name?: string; value?: number | null }) {
  return (
    <fieldset>
      <legend className="label">Relationship strength</legend>
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <label
            key={n}
            title={`${STRENGTH_SCALE[n].label}: ${STRENGTH_SCALE[n].hint}`}
            className="group flex cursor-pointer flex-col items-center rounded-xl border border-line bg-card py-1.5 text-sm font-semibold tabular-nums transition hover:border-accent has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper"
          >
            <input type="radio" name={name} value={n} defaultChecked={value === n} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>Unknown</span>
        <span>Familiar</span>
        <span>Inner circle</span>
      </div>
    </fieldset>
  );
}

/** Seven small bars, filled up to the strength. */
export function StrengthBadge({ value, showLabel = false }: { value: number | null; showLabel?: boolean }) {
  if (!value) return <span className="text-muted">Unrated</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title={`${value}/7 · ${STRENGTH_SCALE[value].label}: ${STRENGTH_SCALE[value].hint}`}>
      <span className="flex items-end gap-[2px]">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <span key={n} className={`w-[3px] rounded-sm ${n <= value ? "bg-accent" : "bg-line"}`} style={{ height: 4 + n * 1.3 }} />
        ))}
      </span>
      {showLabel && <span>{STRENGTH_SCALE[value].label}</span>}
    </span>
  );
}
