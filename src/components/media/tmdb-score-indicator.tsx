import { Star } from "lucide-react";
import { CompactScoreCorner } from "@/components/media/compact-score-corner";

export function TmdbScoreIndicator({ rating }: { rating?: number | null }) {
  const score = Number(rating);
  if (!Number.isFinite(score) || score <= 0) return null;

  const displayScore = Math.round(score * 10) / 10;

  return (
    <CompactScoreCorner
      className="tvtime-tmdb-score"
      side="right"
      tone="amber"
      scoreSource="tmdb"
      value={displayScore.toFixed(1)}
      suffix="/10"
      icon={<Star className="h-[9px] w-[9px] fill-current" aria-hidden="true" />}
      title={`TMDB rating: ${displayScore.toFixed(1)} out of 10`}
      ariaLabel={`TMDB rating ${displayScore.toFixed(1)} out of 10`}
    />
  );
}
