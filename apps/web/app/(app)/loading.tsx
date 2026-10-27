// P15: shown while a page's server data loads (every (app) page is dynamic).
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="bg-muted h-8 w-56 animate-pulse rounded-md motion-reduce:animate-none" />
      <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded motion-reduce:animate-none" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border bg-card h-16 animate-pulse rounded-lg border motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
