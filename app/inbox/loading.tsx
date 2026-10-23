import { Bar, Circle, HeaderSkeleton } from "@/components/Skeleton";

/** Same shape as an inbox card, so the real one replaces it without a jump. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="mb-6 h-1.5 rounded-full bg-line" />
      {[0, 1].map((i) => (
        <div key={i} className="mb-4 rounded-3xl border border-line bg-card p-5">
          <div className="flex gap-4"><Circle size={72} /><div className="flex-1 space-y-2 pt-1"><Bar w="50%" h={16} /><Bar w="70%" /><Bar w="40%" /></div></div>
          <div className="mt-5 space-y-3"><Bar w={140} /><Bar w="60%" h={38} /><Bar w={160} /><div className="flex gap-2">{Array.from({ length: 7 }, (_, k) => <Bar key={k} w={36} h={30} />)}</div></div>
        </div>
      ))}
    </div>
  );
}
