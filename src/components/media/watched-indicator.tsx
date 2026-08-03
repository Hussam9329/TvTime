import { Check } from "lucide-react";

type WatchedIndicatorProps = {
  rating?: number | null;
  status?: "watched" | "finished";
};

export function WatchedIndicator({ rating, status = "watched" }: WatchedIndicatorProps) {
  const label = status === "finished" ? "Finished" : "Watched";

  return (
    <span
      data-score-source="user"
      data-status={status}
      dir="ltr"
      title={rating != null ? `${label} · Your rating: ${rating}/100` : label}
      aria-label={rating != null ? `${label}, your rating ${rating} out of 100` : label}
      className="pointer-events-none absolute -left-px -top-px z-20 inline-flex h-7 items-center gap-1 rounded-br-xl border-b border-r border-emerald-200/40 bg-[linear-gradient(135deg,rgba(110,231,183,0.98),rgba(16,185,129,0.96))] px-2 pr-2.5 text-emerald-950 shadow-[3px_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.45)]">
        <Check className="h-3 w-3 stroke-[3.5]" aria-hidden="true" />
      </span>
      {rating != null && (
        <span className="whitespace-nowrap text-[10px] font-extrabold leading-none tracking-tight">
          {rating}<span className="ml-0.5 text-[7px] font-semibold text-emerald-950/70">/100</span>
        </span>
      )}
    </span>
  );
}
