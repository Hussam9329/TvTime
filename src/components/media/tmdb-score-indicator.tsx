import { Star } from "lucide-react";

export function TmdbScoreIndicator({ rating }: { rating?: number | null }) {
  const score = Number(rating);
  if (!Number.isFinite(score) || score <= 0) return null;

  const displayScore = Math.round(score * 10) / 10;

  return (
    <span
      data-score-source="tmdb"
      className="tvtime-tmdb-score pointer-events-none absolute -right-px -top-px z-20 inline-flex h-7 items-center gap-1 rounded-bl-xl border-b border-l border-amber-200/40 bg-[linear-gradient(225deg,rgba(254,240,138,0.98),rgba(234,179,8,0.96))] px-2 pl-2.5 text-amber-950 shadow-[-3px_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-md"
      title={`TMDB rating: ${displayScore.toFixed(1)} out of 10`}
      aria-label={`TMDB rating ${displayScore.toFixed(1)} out of 10`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-300 shadow-[0_0_10px_rgba(250,204,21,0.45)]">
        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap text-[10px] font-extrabold leading-none tracking-tight">
        {displayScore.toFixed(1)}
        <span className="ml-0.5 text-[7px] font-semibold text-amber-950/70">/10</span>
      </span>
    </span>
  );
}
