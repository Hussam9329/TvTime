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
  left: "-left-px flex-row rounded-[10px]",
  right: "-right-px flex-row rounded-[10px]",
} as const;

const TONE_STYLES = {
  emerald: {
    surface: "border-emerald-400/75 bg-[#06120e]/90 text-emerald-300 shadow-[0_7px_18px_rgba(0,0,0,0.36),0_0_14px_rgba(52,211,153,0.12)]",
    icon: "text-emerald-300",
    suffix: "text-emerald-300/65",
  },
  amber: {
    surface: "border-amber-400/75 bg-[#140f06]/90 text-amber-300 shadow-[0_7px_18px_rgba(0,0,0,0.36),0_0_14px_rgba(251,191,36,0.12)]",
    icon: "text-amber-300",
    suffix: "text-amber-300/65",
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
      className={`${className} pointer-events-none absolute -top-px z-20 inline-flex h-[28px] min-w-[66px] items-center justify-center gap-1.5 overflow-hidden border px-2 backdrop-blur-md ${SIDE_STYLES[side]} ${colors.surface}`}
    >
      <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center ${colors.icon}`}>
        {icon}
      </span>
      {value != null && (
        <span className="whitespace-nowrap text-[10px] font-extrabold tabular-nums leading-none tracking-tight">
          {value}
          <span className={`ml-px text-[7px] font-bold ${colors.suffix}`}>{suffix}</span>
        </span>
      )}
    </span>
  );
}
