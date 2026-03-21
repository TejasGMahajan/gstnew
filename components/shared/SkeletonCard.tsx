export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="stat-card animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-slate-200 rounded w-24" />
          <div className="h-8 bg-slate-200 rounded w-16 mt-3" />
          {lines > 2 && <div className="h-3 bg-slate-200 rounded w-32" />}
        </div>
        <div className="w-11 h-11 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-40" />
        <div className="h-3 bg-slate-200 rounded w-24" />
      </div>
      <div className="h-6 w-16 bg-slate-200 rounded-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
