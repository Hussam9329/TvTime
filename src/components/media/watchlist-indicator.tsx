import { Bookmark } from "lucide-react";

export function WatchlistIndicator() {
  return (
    <span
      className="tvtime-watchlist-indicator"
      data-state="watchlist"
      title="In watchlist"
      aria-label="In watchlist"
    >
      <Bookmark className="fill-current" aria-hidden="true" />
    </span>
  );
}
