export function QueueSkeleton() {
  return (
    <>
      <div className="hidden md:block">
        <div className="glass-panel rounded-[1.8rem] border p-4">
          <div className="mb-4 h-5 w-64 rounded-lg skeleton-shimmer" />
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-6 gap-3 border-b border-white/10 bg-slate-900/40 px-4 py-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-3 rounded skeleton-shimmer" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, row) => (
              <div key={row} className="grid grid-cols-6 gap-3 border-b border-white/5 px-4 py-4 last:border-none">
                {Array.from({ length: 6 }).map((_, col) => (
                  <div key={col} className="h-4 rounded skeleton-shimmer" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, card) => (
          <div key={card} className="glass-panel rounded-2xl border p-4">
            <div className="mb-3 h-4 w-40 rounded skeleton-shimmer" />
            <div className="mb-3 h-3 w-24 rounded skeleton-shimmer" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-10 rounded skeleton-shimmer" />
              <div className="h-10 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
