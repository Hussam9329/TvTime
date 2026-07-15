"use client";

import { cn } from "@/lib/utils";
import type { MediaItem, MediaType, MediaStatus } from "@/lib/types";
import { pickGradient } from "@/lib/mock-data";

const STATUS_LABELS: Record<MediaStatus, { ar: string; en: string; color: string }> = {
  watchlist: { ar: "قائمة المشاهدة", en: "Watchlist", color: "bg-amber-500" },
  plan_to_watch: { ar: "أخطط لمشاهدته", en: "Plan to Watch", color: "bg-blue-500" },
  watching: { ar: "أشاهد الآن", en: "Watching", color: "bg-emerald-500" },
  completed: { ar: "مكتمل", en: "Completed", color: "bg-green-600" },
  on_hold: { ar: "متوقف مؤقتًا", en: "On Hold", color: "bg-yellow-500" },
  dropped: { ar: "تخليت عنه", en: "Dropped", color: "bg-red-500" },
};

export function StatusBadge({ status, size = "md" }: { status: MediaStatus; size?: "sm" | "md" }) {
  const s = STATUS_LABELS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium text-white",
        s.color,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
      {s.ar}
    </span>
  );
}

export function MediaCard({
  media,
  onClick,
  variant = "poster",
}: {
  media: MediaItem;
  onClick?: () => void;
  variant?: "poster" | "backdrop" | "compact";
}) {
  const gradient = pickGradient(media.tmdbId);

  if (variant === "backdrop") {
    return (
      <button
        onClick={onClick}
        className="card-hover group relative w-full overflow-hidden rounded-xl bg-card text-right"
      >
        <div className={cn("relative aspect-video bg-gradient-to-br", gradient)}>
          <div className="absolute inset-0 hero-fade" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="text-white font-bold text-sm line-clamp-1">{media.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/80 text-xs">
                {media.releaseDate ? new Date(media.releaseDate).getFullYear() : ""}
              </span>
              {media.voteAverage && (
                <span className="text-white/80 text-xs">★ {media.voteAverage.toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="p-2 flex items-center justify-between">
          <StatusBadge status={media.status} size="sm" />
          {media.userRating && (
            <span className="text-xs text-muted-foreground">تقييمك: {media.userRating}</span>
          )}
        </div>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        className="card-hover flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent text-right"
      >
        <div className={cn("w-10 h-14 rounded bg-gradient-to-br shrink-0", gradient)} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate">{media.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <StatusBadge status={media.status} size="sm" />
            {media.userRating && <span>• {media.userRating}/100</span>}
          </div>
        </div>
      </button>
    );
  }

  // Default poster variant
  return (
    <button
      onClick={onClick}
      className="card-hover group relative w-full overflow-hidden rounded-xl bg-card text-right"
    >
      <div className={cn("relative aspect-[2/3] bg-gradient-to-br", gradient)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {media.favorite && (
          <div className="absolute top-2 right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
            ♥
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <h3 className="text-white font-bold text-xs line-clamp-2 leading-tight">{media.title}</h3>
          {media.voteAverage && (
            <span className="text-white/80 text-[10px]">★ {media.voteAverage.toFixed(1)}</span>
          )}
        </div>
      </div>
      <div className="p-2">
        <StatusBadge status={media.status} size="sm" />
      </div>
    </button>
  );
}

export function StatusCounter({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-colors min-w-[80px]",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"
      )}
    >
      <span className="text-2xl font-bold tabular-nums">{count}</span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
    </button>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PosterRail({ items, onSelect }: { items: MediaItem[]; onSelect?: (m: MediaItem) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
      {items.map((m) => (
        <div key={m.id} className="w-32 shrink-0">
          <MediaCard media={m} onClick={() => onSelect?.(m)} />
        </div>
      ))}
    </div>
  );
}

export function BackdropRail({ items, onSelect }: { items: MediaItem[]; onSelect?: (m: MediaItem) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
      {items.map((m) => (
        <div key={m.id} className="w-72 shrink-0">
          <MediaCard media={m} variant="backdrop" onClick={() => onSelect?.(m)} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-muted-foreground/40 mb-3">{icon}</div>}
      <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}

export function SkeletonCard() {
  return <div className="w-32 aspect-[2/3] rounded-xl shimmer" />;
}

export function SkeletonRail({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
