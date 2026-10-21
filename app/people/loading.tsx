import { Bar, Circle, HeaderSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <Bar w={420} h={40} className="mb-4 max-w-full" />
      <div className="mb-6 flex flex-wrap gap-2">{Array.from({ length: 9 }, (_, i) => <Bar key={i} w={72} h={28} />)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-card px-3 pb-4 pt-5">
            <Circle size={96} />
            <Bar w="70%" h={14} className="mt-2" />
            <Bar w="50%" />
          </div>
        ))}
      </div>
    </div>
  );
}
