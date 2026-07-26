import { Check } from "lucide-react";

export function WatchedIndicator() {
  return (
    <span
      data-status="watched"
      title="Watched"
      aria-label="Watched"
      className="pointer-events-none absolute -left-5 -top-5 z-20 h-12 w-12 rounded-full border border-emerald-200/70 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_5px_16px_rgba(16,185,129,0.45)]"
    >
      <Check
        className="absolute bottom-1 right-1 h-[18px] w-[18px] rounded-full bg-white/15 p-0.5 stroke-[3.5] drop-shadow"
        aria-hidden="true"
      />
    </span>
  );
}
