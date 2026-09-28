/** Shared loading layout for every movie, TV and anime world Overview. */
export function HubSkeleton({ label, shelves = 4 }: { label: string; shelves?: number }) {
  return (
    <div className="tvtime-movie-hub__skeleton" role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="h-[clamp(22rem,48vw,34rem)] rounded-3xl shimmer" />
      {Array.from({ length: shelves }).map((_, section) => (
        <div key={section}>
          <div className="mb-3 h-6 w-44 rounded shimmer" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((__, card) => <div key={card} className="aspect-[2/3] w-36 shrink-0 rounded-2xl shimmer" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
