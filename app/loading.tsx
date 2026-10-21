import { Bar, Circle, HeaderSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4 rounded-3xl border border-line bg-card p-4">
            <Circle size={72} />
            <div className="flex-1 space-y-2 pt-1">
              <Bar w="55%" h={16} />
              <Bar w="40%" />
              <Bar w="70%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
