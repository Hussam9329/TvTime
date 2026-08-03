import { Check } from "lucide-react";
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
      icon={<Check className="h-[9px] w-[9px] stroke-[3.5]" aria-hidden="true" />}
      title={rating != null ? `${label} · Your rating: ${rating}/100` : label}
      ariaLabel={rating != null ? `${label}, your rating ${rating} out of 100` : label}
    />
  );
}
