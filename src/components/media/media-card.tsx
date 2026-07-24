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
  const typeLabel = isArabic ? (mediaType === "movie" ? "Arabic Movie" : "Arabic TV") : (mediaType === "movie" ? "Movie" : "TV");
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
      className="cursor-pointer group"
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
      <Card className="h-full overflow-hidden p-0 border-border/50 hover:border-primary/55 transition-[border-color,box-shadow,background-color] duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <SafeImage
            src={imgOrPlaceholder(item.poster_path, "w342")}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="relative w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95"
          />
          {/* top badges */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
            {showMediaType && !compactActions && (
              <Badge
                variant="secondary"
                className="bg-black/60 backdrop-blur text-white border-0 text-[10px] h-6 px-2"
              >
                {mediaType === "movie" ? <Film className="w-3 h-3 mr-1" /> : <Tv className="w-3 h-3 mr-1" />}
                {typeLabel}
              </Badge>
            )}
            {/* Fix #8: TMDB score labeled explicitly as /10 */}
            {rating > 0 && (
              <Badge className="bg-black/60 backdrop-blur text-amber-300 border-0 text-[10px] h-6 px-2" title="TMDB Score">
                <Star className="w-3 h-3 mr-1 fill-amber-300" />
                {rating.toFixed(1)}/10
              </Badge>
            )}
          </div>

        </div>
        <div className={`${compactActions ? "flex min-h-[4.5rem] items-center gap-2" : "min-h-[5.5rem]"} border-t border-border/50 bg-card px-3 py-2.5`}>
          <div className="min-w-0 flex-1">
            <h3 className={`${compactActions ? "line-clamp-1" : "line-clamp-2 min-h-10"} text-sm font-semibold leading-tight text-foreground`}>{title}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {year && <span>{year}</span>}
              {year && compactActions && <span>•</span>}
              {compactActions && <span>{typeLabel}</span>}
            </div>
          </div>
          {compactActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" aria-label={`More actions for ${title}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{title}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleClick}><Play /> Open details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void toggleWatchlist()} disabled={watchlistToggle.isPending}><ListPlus /> {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}</DropdownMenuItem>
                {mediaType === "movie" && <DropdownMenuItem onSelect={() => void toggleWatched()} disabled={watchedToggle.isPending}><Check /> {watched ? "Remove from watched" : "Mark as watched"}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="ml-auto flex items-center gap-1">
              {inWatchlist && <span className="inline-flex items-center gap-0.5 rounded bg-primary/20 px-1 py-0.5 text-[9px] text-primary"><ListPlus className="h-2.5 w-2.5" /> Watchlist</span>}
              {watched && <span data-status="watched" className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] text-emerald-400"><Check className="h-2.5 w-2.5" /> Watched</span>}
              {isFollowing && <span data-status="following" className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-400"><Bell className="h-2.5 w-2.5" /> Following</span>}
              {userRating != null && <span data-status="rated" className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-300"><Star className="h-2.5 w-2.5 fill-current" /> {userRating}/100</span>}
            </div>
          )}
        </div>
      </Card>
    </motion.a>
  );
}

export function MediaCardSkeleton() {
  return (
    <Card className="feedback-skeleton overflow-hidden p-0 border-border/50 bg-card" aria-hidden="true">
      <div className="aspect-[2/3] shimmer" />
      <div className="h-[5.5rem] border-t border-border/50 bg-card" />
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
      <div className="feedback-grid feedback-grid--loading grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4" role="status" aria-busy="true" aria-label="Loading media">
        {Array.from({ length: 12 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
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
