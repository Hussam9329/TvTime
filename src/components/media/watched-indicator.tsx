import { Check, Star } from "lucide-react";
import { CompactScoreCorner } from "@/components/media/compact-score-corner";

type WatchedIndicatorProps = {
  rating?: number | null;
  status?: "watched" | "finished";
};

export function WatchedIndicator({ rating, status = "watched" }: WatchedIndicatorProps) {
  const label = status === "finished" ? "Finished" : "Watched";

  return (
    <CompactScoreCorner
      className="tvtime-user-score"
      side="left"
      tone="emerald"
      scoreSource="user"
      status={status}
      value={rating}
      suffix="/100"
      icon={rating != null
        ? <Star className="h-[11px] w-[11px] fill-current" aria-hidden="true" />
        : <Check className="h-[11px] w-[11px] stroke-[3.25]" aria-hidden="true" />}
      title={rating != null ? `${label} · Your rating: ${rating}/100` : label}
      ariaLabel={rating != null ? `${label}, your rating ${rating} out of 100` : label}
    />
  );
}
