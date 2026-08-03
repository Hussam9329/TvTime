import type { ReactNode } from "react";

type CompactScoreCornerProps = {
  side: "left" | "right";
  tone: "emerald" | "amber";
  scoreSource: "user" | "tmdb";
  status?: "watched" | "finished";
  value?: string | number | null;
  suffix: "/100" | "/10";
  icon: ReactNode;
  title: string;
  ariaLabel: string;
  className?: string;
};

const SIDE_STYLES = {
  left: "-left-px flex-row-reverse rounded-r-full border-r pr-2 shadow-[2px_2px_7px_rgba(0,0,0,0.24)]",
  right: "-right-px flex-row rounded-l-full border-l pl-2 shadow-[-2px_2px_7px_rgba(0,0,0,0.24)]",
} as const;

const TONE_STYLES = {
  emerald: {
    surface: "border-emerald-200/55 bg-emerald-400/95 text-emerald-950",
    icon: "bg-emerald-950/90 text-emerald-200",
    suffix: "text-emerald-950/65",
  },
  amber: {
    surface: "border-amber-100/55 bg-amber-300/95 text-amber-950",
    icon: "bg-amber-950/90 text-amber-200",
    suffix: "text-amber-950/65",
  },
} as const;

export function CompactScoreCorner({
  side,
  tone,
  scoreSource,
  status,
  value,
  suffix,
  icon,
  title,
  ariaLabel,
  className = "",
}: CompactScoreCornerProps) {
  const colors = TONE_STYLES[tone];

  return (
    <span
      data-score-source={scoreSource}
      data-status={status}
      dir="ltr"
      title={title}
      aria-label={ariaLabel}
      className={`${className} pointer-events-none absolute -top-px z-20 inline-flex h-[22px] w-[58px] items-center justify-center gap-0.5 overflow-hidden border-b px-1.5 ${SIDE_STYLES[side]} ${colors.surface}`}
    >
      <span className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${colors.icon}`}>
        {icon}
      </span>
      {value != null && (
        <span className="whitespace-nowrap text-[8px] font-extrabold tabular-nums leading-none tracking-tight">
          {value}
          <span className={`ml-px text-[6px] font-bold ${colors.suffix}`}>{suffix}</span>
        </span>
      )}
    </span>
  );
}
