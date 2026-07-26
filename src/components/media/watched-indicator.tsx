import { Check } from "lucide-react";

export function WatchedIndicator() {
  return (
    <span
      data-status="watched"
      title="Watched"
      aria-label="Watched"
      className="pointer-events-none absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-emerald-500 text-white shadow-md shadow-black/30"
    >
      <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
    </span>
  );
}
