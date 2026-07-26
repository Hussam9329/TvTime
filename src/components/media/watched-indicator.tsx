import { Check } from "lucide-react";

export function WatchedIndicator({ rating }: { rating?: number | null }) {
  return (
    <span
      data-status="watched"
      title={rating != null ? `Watched · Your rating: ${rating}/100` : "Watched"}
      aria-label={rating != null ? `Watched, your rating ${rating} out of 100` : "Watched"}
      className="pointer-events-none absolute -left-8 -top-8 z-20 h-20 w-20 rounded-full border border-emerald-200/70 bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 text-white shadow-[0_7px_20px_rgba(16,185,129,0.48)]"
    >
      <Check
        className={`absolute right-2.5 h-5 w-5 rounded-full bg-white/15 p-0.5 stroke-[3.5] drop-shadow ${rating != null ? "bottom-5" : "bottom-2.5"}`}
        aria-hidden="true"
      />
      {rating != null && (
        <span className="absolute bottom-1.5 right-1.5 min-w-7 text-center text-[9px] font-extrabold leading-none tracking-tight drop-shadow">
          {rating}<span className="text-[6px] font-semibold opacity-90">/100</span>
        </span>
      )}
    </span>
  );
}
