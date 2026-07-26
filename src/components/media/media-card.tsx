"use client";

import { imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv, Check, ListPlus, Bell, MoreHorizontal, Play } from "lucide-react";
import { useNav } from "@/lib/store";
import { mediaStateKey, useMediaStates, useWatchlistToggle, useWatchedMovieToggle, type MediaBatchState } from "@/hooks/use-tmdb";
import { motion } from "framer-motion";
import { SafeImage } from "@/components/media/safe-image";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { isAnimeMediaItem } from "@/lib/anime-detect";
import { isAsianMediaItem } from "@/lib/asian-media";

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  showMediaType?: boolean;
  forcedMediaType?: "movie" | "tv";
  libraryState?: MediaBatchState | null;
  enableNativeLink?: boolean;
  priority?: boolean;
  compactActions?: boolean;
}

// Single source of truth for card sizing and grid layout.
// Change card presentation here only; parent sections merely place cards.
export const MEDIA_CARD_ROW_WIDTH_CLASS = "w-[130px] sm:w-[160px]";
export const MEDIA_CARD_GRID_CLASS = "grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

export function MediaCard({ item, index = 0, showMediaType = true, forcedMediaType, libraryState, enableNativeLink = true, priority = false, compactActions = true }: MediaCardProps) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();

  // Fix #1: Use forcedMediaType if provided (e.g., TV rows in Home/Discover).
  // Otherwise fall back to item.media_type. Default to "movie" only when
  // neither is available — never guess from title/name.
  const mediaType: "movie" | "tv" = forcedMediaType
    ? forcedMediaType
    : item.media_type === "tv"
      ? "tv"
      : "movie";

  // Card badges come from the batched state endpoint for only the visible IDs.
  const inWatchlist = Boolean(libraryState?.inWatchlist);
  const watched = mediaType === "movie" ? Boolean(libraryState?.watched) : false;
  const isFollowing = mediaType === "tv" ? Boolean(libraryState?.isFollowing) : false;
  const userRating = libraryState?.userRating ?? null;

  const id = Number(item.id);
  const detailHref = Number.isFinite(id) && id > 0 ? `/${mediaType}/${id}` : undefined;

  const handleClick = () => {
    // Validate tmdbId before navigating — prevents opening broken profiles
    if (!Number.isFinite(id) || id <= 0) return;
    if (mediaType === "movie") goMovie(id);
    else goTv(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const rating = item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0;
  const title = getTitle(item);
  const year = getYear(item);
  const isArabic = isArabicMediaItem(item);
  const isAnime = mediaType === "tv" && isAnimeMediaItem(item);
  const isAsian = mediaType === "tv" && !isAnime && !isArabic && isAsianMediaItem(item);
  const typeLabel = isAnime
    ? "Anime"
    : isAsian
      ? "Asian TV"
    : isArabic
      ? (mediaType === "movie" ? "Arabic Movie" : "Arabic TV")
      : (mediaType === "movie" ? "Movie" : "TV");
  const actionPayload = { tmdbId: id, title, posterPath: item.poster_path, releaseDate: item.release_date || item.first_air_date, voteAverage: item.vote_average, overview: item.overview, originalLanguage: item.original_language, originCountry: item.origin_country };
  const toggleWatchlist = async () => {
    try {
      await watchlistToggle.mutateAsync({ ...actionPayload, mediaType, action: inWatchlist ? "remove" : "add" });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch { toast.error("Failed to update watchlist"); }
  };
  const toggleWatched = async () => {
    try {
      await watchedToggle.mutateAsync({ ...actionPayload, action: watched ? "remove" : "add" });
      toast.success(watched ? "Removed from watched" : "Marked as watched");
    } catch { toast.error("Failed to update watched status"); }
  };

  return (
    <motion.a
      href={enableNativeLink ? detailHref : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="group min-w-0 cursor-pointer"
      onClick={(event) => {
        if (enableNativeLink && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        handleClick();
      }}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${title}${year ? ` (${year})` : ""}`}
    >
      <Card className="h-full gap-0 overflow-hidden rounded-[clamp(0.9rem,1.4vw,1.25rem)] border-border/50 bg-card p-0 transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/55 hover:shadow-lg hover:shadow-primary/10">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <SafeImage
            src={imgOrPlaceholder(item.poster_path, "w342")}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="relative w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95"
          />
          {watched && <WatchedIndicator rating={userRating} />}
          {/* top badges */}
          <div className="absolute left-1 right-1 top-1 flex min-w-0 items-start justify-between gap-1 sm:left-2 sm:right-2 sm:top-2 sm:gap-2">
            {!watched && rating > 0 ? (
              <Badge className="ml-auto h-5 shrink-0 border-0 bg-black/65 px-1.5 text-[9px] text-amber-300 backdrop-blur sm:h-6 sm:px-2 sm:text-[10px]" title="TMDB Score">
                <Star className="mr-1 h-2.5 w-2.5 shrink-0 fill-amber-300 sm:h-3 sm:w-3" />
                {rating.toFixed(1)}/10
              </Badge>
            ) : null}
          </div>

        </div>
        <div className="flex min-w-0 flex-col border-t border-border/60 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)/0.96))] px-2 py-2 sm:px-2.5 sm:py-2.5">
          <h3 className="truncate text-left text-[12px] font-semibold leading-5 text-foreground sm:text-[13px]" title={title}>
            {title}
          </h3>

          <div className="my-1.5 h-px w-full bg-border/45" />

          <div className="flex min-h-5 min-w-0 items-center justify-between gap-1.5 text-[10px] text-muted-foreground sm:text-[11px]">
            {year && <span className="shrink-0">{year}</span>}
            {showMediaType && (
              <span
                className={`inline-flex h-5 min-w-0 max-w-[72%] items-center gap-1 rounded-md border px-1.5 text-[9px] font-semibold ${
                  isAnime
                    ? "border-violet-400/45 bg-violet-500/10 text-violet-300"
                    : isAsian
                    ? "border-teal-400/45 bg-teal-500/10 text-teal-300"
                    : mediaType === "movie"
                    ? "border-fuchsia-400/45 bg-fuchsia-500/10 text-fuchsia-300 shadow-fuchsia-500/10"
                    : "border-cyan-400/45 bg-cyan-500/10 text-cyan-300 shadow-cyan-500/10"
                }`}
              >
                {mediaType === "movie" ? <Film className="h-2.5 w-2.5 shrink-0" /> : <Tv className="h-2.5 w-2.5 shrink-0" />}
                <span className="truncate">{typeLabel}</span>
              </span>
            )}
          </div>

          {(watched || inWatchlist || isFollowing || compactActions) && <div className="flex min-w-0 items-center gap-1 pt-1.5">
            {watched ? (
              <span data-status="watched" className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-1.5 text-[10px] font-semibold text-emerald-400">
                <Check className="h-3 w-3 shrink-0" /> <span className="truncate">Watched</span>
              </span>
            ) : inWatchlist ? (
              <span className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-pink-500/30 bg-pink-500/10 px-1.5 text-[10px] font-semibold text-pink-400">
                <ListPlus className="h-3 w-3 shrink-0" /> <span className="truncate">Watchlist</span>
              </span>
            ) : isFollowing ? (
              <span data-status="following" className="inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-amber-400/35 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-400">
                <Bell className="h-3 w-3 shrink-0" /> <span className="truncate">Following</span>
              </span>
            ) : null}

            {compactActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-7 w-7 shrink-0 rounded-md p-0" aria-label={`More actions for ${title}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{title}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleClick}><Play /> Open details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void toggleWatchlist()} disabled={watchlistToggle.isPending}><ListPlus /> {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}</DropdownMenuItem>
                {mediaType === "movie" && <DropdownMenuItem onSelect={() => void toggleWatched()} disabled={watchedToggle.isPending}><Check /> {watched ? "Remove from watched" : "Mark as watched"}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>}
        </div>
      </Card>
    </motion.a>
  );
}

export function MediaCardSkeleton() {
  return (
    <Card className="feedback-skeleton gap-0 overflow-hidden rounded-[clamp(0.9rem,1.4vw,1.25rem)] border-border/50 bg-card p-0" aria-hidden="true">
      <div className="aspect-[2/3] shimmer" />
      <div className="h-[86px] border-t border-border/50 bg-card" />
    </Card>
  );
}

interface MediaGridProps {
  items: MediaItem[];
  loading?: boolean;
  showMediaType?: boolean;
  forcedMediaType?: "movie" | "tv";
  libraryStates?: Record<string, MediaBatchState>;
  enableNativeLinks?: boolean;
}

export function MediaGrid({ items, loading, showMediaType = true, forcedMediaType, libraryStates, enableNativeLinks = true }: MediaGridProps) {
  const stateRequests = items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
  }));
  const states = useMediaStates(stateRequests, { enabled: libraryStates === undefined });
  const resolvedStates = libraryStates ?? states.data;

  if (loading) {
    return (
      <div className={MEDIA_CARD_GRID_CLASS} role="status" aria-busy="true" aria-label="Loading media">
        {Array.from({ length: 12 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className={MEDIA_CARD_GRID_CLASS}>
      {items.map((item, i) => (
        <MediaCard
          key={`${item.id}-${item.media_type || ""}`}
          item={item}
          index={i}
          showMediaType={showMediaType}
          forcedMediaType={forcedMediaType}
          libraryState={resolvedStates?.[mediaStateKey(
            forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
            Number(item.id),
          )] ?? null}
          enableNativeLink={enableNativeLinks}
          priority={i < 4}
        />
      ))}
    </div>
  );
}
