import { Check } from "lucide-react";

export function WatchedIndicator({ rating }: { rating?: number | null }) {
  return (
    <span
      data-status="watched"
      title={rating != null ? `Watched · Your rating: ${rating}/100` : "Watched"}
      aria-label={rating != null ? `Watched, your rating ${rating} out of 100` : "Watched"}
      className="pointer-events-none absolute left-0 top-0 z-20 inline-flex h-9 items-center gap-1.5 rounded-br-2xl border-b border-r border-emerald-300/30 bg-[linear-gradient(135deg,rgba(4,20,18,0.96),rgba(5,150,105,0.94))] px-2.5 pr-3 text-white shadow-[4px_5px_18px_rgba(0,0,0,0.38)] backdrop-blur-md"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_0_12px_rgba(52,211,153,0.55)]">
        <Check className="h-3.5 w-3.5 stroke-[3.5]" aria-hidden="true" />
      </span>
      {rating != null && (
        <span className="whitespace-nowrap text-[11px] font-extrabold leading-none tracking-tight">
          {rating}<span className="ml-0.5 text-[8px] font-semibold text-emerald-100/80">/100</span>
        </span>
      )}
    </span>
  );
}
