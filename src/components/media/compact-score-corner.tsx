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
  left: "-left-px flex-row rounded-[9px]",
  right: "-right-px flex-row rounded-[9px]",
} as const;

const TONE_STYLES = {
  emerald: {
    surface: "border-emerald-400/75 bg-[#06120e]/90 text-emerald-300 shadow-[0_5px_14px_rgba(0,0,0,0.34),0_0_10px_rgba(52,211,153,0.1)]",
    icon: "text-emerald-300",
    suffix: "text-emerald-300/65",
  },
  amber: {
    surface: "border-amber-400/75 bg-[#140f06]/90 text-amber-300 shadow-[0_5px_14px_rgba(0,0,0,0.34),0_0_10px_rgba(251,191,36,0.1)]",
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
