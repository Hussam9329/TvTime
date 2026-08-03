import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

/** Trakora's T monogram combines playback with an orbit-like tracking path. */
export function BrandMark({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "tvtime-brand-mark relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white transition-[box-shadow,filter] duration-200 group-hover:brightness-105 sm:h-10 sm:w-10",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" fill="none">
        <path d="M11 11.5h15.5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M18.75 12.25v15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="m24.25 17.25 5.25 3.5-5.25 3.5v-7Z" fill="currentColor" />
        <path
          d="M9.25 25.1c2.2 4.25 8.25 6.45 13.65 4.85 2.65-.78 4.85-2.45 6.15-4.65"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
          opacity=".68"
        />
        <circle cx="29.45" cy="24.3" r="1.45" fill="currentColor" />
        <path d="M7.5 8.25h25" stroke="white" strokeWidth="1" strokeLinecap="round" opacity=".3" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: BrandLogoProps) {
  return (
    <span className={cn("tvtime-brand-wordmark font-black leading-none tracking-[-0.045em]", className)}>
      Trak<span className="text-primary">ora</span>
    </span>
  );
}
