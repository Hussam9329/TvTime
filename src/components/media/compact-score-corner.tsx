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
  left: "-left-px flex-row rounded-[0.55rem]",
  right: "-right-px flex-row rounded-[0.55rem]",
} as const;

const TONE_STYLES = {
  emerald: {
    surface: "border-emerald-500/70 bg-card/90 text-emerald-700 dark:text-emerald-300 shadow-[var(--app-shadow-sm)]",
    icon: "text-emerald-600 dark:text-emerald-300",
    suffix: "text-emerald-700/65 dark:text-emerald-300/65",
  },
  amber: {
    surface: "border-amber-500/70 bg-card/90 text-amber-700 dark:text-amber-300 shadow-[var(--app-shadow-sm)]",
    icon: "text-amber-600 dark:text-amber-300",
    suffix: "text-amber-700/65 dark:text-amber-300/65",
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
      className={`${className} pointer-events-none absolute -top-px z-20 inline-flex h-[24px] min-w-[58px] items-center justify-center gap-1 overflow-hidden border px-1.5 backdrop-blur-md ${SIDE_STYLES[side]} ${colors.surface}`}
    >
      <span className={`flex h-3 w-3 shrink-0 items-center justify-center ${colors.icon}`}>
        {icon}
      </span>
      {value != null && (
        <span className="whitespace-nowrap text-[10px] font-bold tabular-nums leading-none tracking-[0.01em]">
          {value}
          <span className={`ml-px text-[7px] font-semibold ${colors.suffix}`}>{suffix}</span>
        </span>
      )}
    </span>
  );
}
