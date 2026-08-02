"use client";

import { imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
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
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
import { RatingDialog } from "@/components/media/rating-dialog";
import { isAnimeMediaItem } from "@/lib/anime-detect";
import { isAsianMediaItem } from "@/lib/asian-media";
import { useState } from "react";
import { useWatchUndo } from "@/hooks/use-watch-undo";

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  showMediaType?: boolean;
  forcedMediaType?: "movie" | "tv";
  libraryState?: MediaBatchState | null;
  libraryStateReady?: boolean;
  enableNativeLink?: boolean;
  priority?: boolean;
  compactActions?: boolean;
}

// Single source of truth for card sizing and grid layout.
// Change card presentation here only; parent sections merely place cards.
export const MEDIA_CARD_ROW_WIDTH_CLASS = "w-[130px] sm:w-[160px]";
const MEDIA_CARD_GRID_CLASS = "grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

export function MediaCard({ item, index = 0, showMediaType = true, forcedMediaType, libraryState, libraryStateReady = false, enableNativeLink = true, priority = false, compactActions = true }: MediaCardProps) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();
  const showWatchUndo = useWatchUndo();
  const [ratingOpen, setRatingOpen] = useState(false);

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
  const finished = mediaType === "tv" && libraryState?.status === "finished";
  const completed = watched || finished;
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
    if (!libraryStateReady) return;
    try {
      await watchlistToggle.mutateAsync({ ...actionPayload, mediaType, action: inWatchlist ? "remove" : "add" });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch { toast.error("Failed to update watchlist"); }
  };
  const toggleWatched = async () => {
    if (!libraryStateReady) return;
    if (!watched) {
      if (userRating != null) {
        try {
          const result = await watchedToggle.mutateAsync({
            ...actionPayload,
            action: "add",
            userRating,
          });
          showWatchUndo(`Marked as watched · Your rating ${userRating}/100`, result);
        } catch {
          toast.error("Failed to update watched status");
        }
        return;
      }
      setRatingOpen(true);
      return;
    }
    try {
      const result = await watchedToggle.mutateAsync({ ...actionPayload, action: "remove" });
      showWatchUndo("Removed from watched", result);
    } catch { toast.error("Failed to update watched status"); }
  };
  const completeWatchedWithRating = async (rating: number) => {
    return watchedToggle.mutateAsync({
      ...actionPayload,
      action: "add",
      userRating: rating,
    });
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
        className="tvtime-media-card group relative min-w-0"
      >
        <Card>
        <a
          href={enableNativeLink ? detailHref : undefined}
          className="tvtime-media-card-link"
          onClick={(event) => {
            if (enableNativeLink && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
            event.preventDefault();
            handleClick();
          }}
          role={!detailHref ? "button" : undefined}
          tabIndex={!detailHref ? 0 : undefined}
          onKeyDown={(event) => {
            if (detailHref || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            handleClick();
          }}
          aria-label={`${title}${year ? ` (${year})` : ""}`}
        >
          <div className="tvtime-media-poster relative aspect-[2/3] overflow-hidden bg-muted">
            <SafeImage
              src={imgOrPlaceholder(item.poster_path, "w342")}
              alt={title}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              className="tvtime-media-poster__image relative h-full w-full object-cover"
            />
            <div className="tvtime-media-poster__veil pointer-events-none absolute inset-0" aria-hidden="true" />

            {completed && (
              <WatchedIndicator
                rating={userRating}
                status={finished ? "finished" : "watched"}
              />
            )}

            {!completed && <TmdbScoreIndicator rating={item.vote_average} />}

            {(inWatchlist || isFollowing || (userRating != null && !completed)) && (
              <span className="tvtime-media-state-rail absolute bottom-2 z-10" aria-label="Library status">
                {inWatchlist && (
                  <span data-state="watchlist" title="In watchlist">
                    <ListPlus aria-hidden="true" />
                  </span>
                )}
                {isFollowing && (
                  <span data-state="following" title="Following">
                    <Bell aria-hidden="true" />
                  </span>
                )}
                {userRating != null && !completed && (
                  <span data-state="rated" title={`Your rating: ${userRating}/100`}>
                    <Star className="fill-current" aria-hidden="true" />
                  </span>
                )}
              </span>
            )}

          </div>

          <div className="tvtime-media-copy">
            <h3 className="tvtime-media-title line-clamp-2 text-left" title={title}>
              {title}
            </h3>
            <div className="tvtime-media-meta">
              {year && <span className="shrink-0 tabular-nums">{year}</span>}
              {year && showMediaType && <span aria-hidden="true">•</span>}
              {showMediaType && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  {mediaType === "movie" ? <Film aria-hidden="true" /> : <Tv aria-hidden="true" />}
                  <span className="truncate">{typeLabel}</span>
                </span>
              )}
            </div>
          </div>
        </a>
        </Card>

        {compactActions && (
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="tvtime-media-menu absolute top-2 z-20 h-8 w-8 p-0"
              aria-label={`More actions for ${title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{title}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={handleClick}><Play /> Open details</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void toggleWatchlist()} disabled={!libraryStateReady || watchlistToggle.isPending}>
              <ListPlus /> {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            </DropdownMenuItem>
            {mediaType === "movie" && (
              <DropdownMenuItem onSelect={() => void toggleWatched()} disabled={!libraryStateReady || watchedToggle.isPending}>
                <Check /> {watched ? "Remove from watched" : "Mark as watched"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
          </DropdownMenu>
        )}
      </motion.article>
      {mediaType === "movie" && (
        <RatingDialog
          open={ratingOpen}
          onOpenChange={setRatingOpen}
          title={title}
          poster={imgOrPlaceholder(item.poster_path, "w185")}
          onRate={completeWatchedWithRating}
          initialRating={userRating}
          description="Choose your rating out of 100 to mark this movie watched. Closing or cancelling keeps it unwatched."
          submitLabel="Save rating & mark watched"
          successMessage={(rating) => `Marked as watched · Your rating ${rating}/100`}
        />
      )}
    </>
  );
}

export function MediaCardSkeleton() {
  return (
    <Card className="tvtime-media-card-skeleton feedback-skeleton" aria-hidden="true">
      <div className="aspect-[2/3] shimmer" />
      <div className="space-y-2 px-1 py-3">
        <div className="h-3.5 w-4/5 rounded shimmer" />
        <div className="h-2.5 w-2/5 rounded shimmer" />
      </div>
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
  const libraryStateReady = libraryStates !== undefined || states.isSuccess;

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
          libraryStateReady={libraryStateReady}
          enableNativeLink={enableNativeLinks}
          priority={i < 4}
        />
      ))}
    </div>
  );
}
