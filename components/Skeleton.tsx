export const Bar = ({ w = "100%", h = 12, className = "" }: { w?: string | number; h?: number; className?: string }) => (
  <div className={`animate-pulse rounded-full bg-line/70 ${className}`} style={{ width: w, height: h }} />
);
export const Circle = ({ size }: { size: number }) => <div className="shrink-0 animate-pulse rounded-full bg-line/70" style={{ width: size, height: size }} />;

export function HeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Bar w={260} h={34} />
      <Bar w={160} />
    </div>
  );
}
