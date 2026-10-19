import { markTalked, skipCycle, snooze } from "@/app/actions";

export default function QuickActions({ id, compact = false }: { id: string; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <form action={markTalked.bind(null, id, undefined)}>
        <button className="btn-primary">Talked</button>
      </form>
      <form action={snooze.bind(null, id, 7)}>
        <button className="btn-ghost">{compact ? "+1w" : <><span className="sm:hidden">+1w</span><span className="hidden sm:inline">Snooze 1w</span></>}</button>
      </form>
      <form action={snooze.bind(null, id, 30)}>
        <button className="btn-ghost">{compact ? "+1mo" : <><span className="sm:hidden">+1mo</span><span className="hidden sm:inline">Snooze 1mo</span></>}</button>
      </form>
      <form action={skipCycle.bind(null, id)}>
        <button className="btn-ghost">Skip</button>
      </form>
    </div>
  );
}
