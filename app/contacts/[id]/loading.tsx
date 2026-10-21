import { Bar, Circle } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-card p-6">
        <Circle size={144} />
        <Bar w="70%" h={26} className="mt-2" />
        <Bar w="50%" />
        <div className="mt-4 grid w-full grid-cols-2 gap-3">{Array.from({ length: 6 }, (_, i) => <Bar key={i} h={44} className="!rounded-xl" />)}</div>
      </div>
      <div className="space-y-6">
        {[120, 90, 220].map((h, i) => <div key={i} className="animate-pulse rounded-3xl border border-line bg-card" style={{ height: h }} />)}
      </div>
    </div>
  );
}
