"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SafeImage } from "@/components/media/safe-image";
import {
  Bell,
  Check,
  Film,
  ListPlus,
  MoreHorizontal,
  Play,
  Star,
  Tv,
} from "lucide-react";
import { toast } from "sonner";

import {
  mediaStateKey,
  useMediaStates,
  useWatchlistToggle,
  useWatchedMovieToggle,
  type MediaBatchState,
} from "@/hooks/use-tmdb";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { useNav } from "@/lib/store";
import { getTitle, getYear, imgOrPlaceholder, type MediaItem } from "@/lib/tmdb";

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

export function MediaCard({
  item,
  showMediaType = true,
  forcedMediaType,
  libraryState,
  enableNativeLink = true,
  priority = false,
  compactActions = true,
}: MediaCardProps) {
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();

  const mediaType: "movie" | "tv" = forcedMediaType
    ? forcedMediaType
    : item.media_type === "tv"
      ? "tv"
      : "movie";

  const inWatchlist = Boolean(libraryState?.inWatchlist);
  const watched = mediaType === "movie" ? Boolean(libraryState?.watched) : false;
  const isFollowing = mediaType === "tv" ? Boolean(libraryState?.isFollowing) : false;
  const userRating = libraryState?.userRating ?? null;

  const id = Number(item.id);
  const canOpen = Number.isFinite(id) && id > 0;
  const detailHref = canOpen ? `/${mediaType}/${id}` : undefined;
  const rating = item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0;
  const title = getTitle(item);
  const year = getYear(item);
  const isArabic = isArabicMediaItem(item);
  const typeLabel = isArabic
    ? mediaType === "movie"
      ? "Arabic Movie"
      : "Arabic TV"
    : mediaType === "movie"
      ? "Movie"
      : "TV";

  const stateLabels = [
    inWatchlist ? "in watchlist" : "",
    watched ? "watched" : "",
    isFollowing ? "following" : "",
    userRating != null ? `your rating ${userRating} out of 100` : "",
  ].filter(Boolean);
  const accessibleLabel = [
    title,
    year ? `released ${year}` : "",
    showMediaType ? typeLabel : "",
    rating > 0 ? `TMDB score ${rating.toFixed(1)} out of 10` : "",
    ...stateLabels,
  ].filter(Boolean).join(", ");

  const handleClick = () => {
    if (!canOpen) return;
    if (mediaType === "movie") goMovie(id);
    else goTv(id);
  };

  const actionPayload = {
    tmdbId: id,
    title,
    posterPath: item.poster_path,
    releaseDate: item.release_date || item.first_air_date,
    voteAverage: item.vote_average,
    overview: item.overview,
    originalLanguage: item.original_language,
    originCountry: item.origin_country,
  };

  const toggleWatchlist = async () => {
    try {
      await watchlistToggle.mutateAsync({
        ...actionPayload,
        mediaType,
        action: inWatchlist ? "remove" : "add",
      });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  const toggleWatched = async () => {
    try {
      await watchedToggle.mutateAsync({
        ...actionPayload,
        action: watched ? "remove" : "add",
      });
      toast.success(watched ? "Removed from watched" : "Marked as watched");
    } catch {
      toast.error("Failed to update watched status");
    }
  };

  const cardContent = (
    <>
      <div className="tvtime-media-poster relative aspect-[2/3] overflow-hidden bg-muted">
        <SafeImage
          src={imgOrPlaceholder(item.poster_path, "w342")}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="tvtime-media-poster__image relative h-full w-full object-cover"
        />
        <div className="tvtime-media-poster__veil absolute inset-0" aria-hidden="true" />

        {rating > 0 && (
          <Badge className="tvtime-media-score absolute left-2.5 top-2.5 border-0" aria-hidden="true" title="TMDB score">
            <Star className="fill-current" />
            {rating.toFixed(1)}
          </Badge>
        )}

        {(inWatchlist || watched || isFollowing || userRating != null) && (
          <span className="tvtime-media-state-rail absolute bottom-2.5 left-2.5" aria-hidden="true">
            {inWatchlist && <span data-state="watchlist" title="In watchlist"><ListPlus /></span>}
            {watched && <span data-state="watched" title="Watched"><Check /></span>}
            {isFollowing && <span data-state="following" title="Following"><Bell /></span>}
            {userRating != null && <span data-state="rated" title={`Your rating: ${userRating}/100`}><Star className="fill-current" /></span>}
          </span>
        )}

        <span className="tvtime-media-open-cue absolute inset-0 m-auto" aria-hidden="true">
          <Play className="fill-current" />
        </span>
      </div>

      <div className="tvtime-media-copy">
        <h3 className="tvtime-media-title line-clamp-2">{title}</h3>
        {(year || showMediaType) && (
          <p className="tvtime-media-meta">
            {year && <span>{year}</span>}
            {year && showMediaType && <span aria-hidden="true">•</span>}
            {showMediaType && (
              <span className="inline-flex items-center gap-1">
                {mediaType === "movie" ? <Film aria-hidden="true" /> : <Tv aria-hidden="true" />}
                {typeLabel}
              </span>
            )}
          </p>
        )}
      </div>
    </>
  );

  return (
    <article className="tvtime-media-card group">
      <Card className="tvtime-media-card-surface h-full p-0">
        {enableNativeLink && detailHref ? (
          <a
            href={detailHref}
            className="tvtime-media-card-link"
            aria-label={accessibleLabel}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              handleClick();
            }}
          >
            {cardContent}
          </a>
        ) : (
          <button
            type="button"
            className="tvtime-media-card-link w-full text-start"
            aria-label={accessibleLabel}
            aria-disabled={!canOpen}
            disabled={!canOpen}
            onClick={handleClick}
          >
            {cardContent}
          </button>
        )}

        {compactActions && canOpen && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="tvtime-media-menu absolute right-2.5 top-2.5 z-20 h-8 w-8"
                aria-label={`More actions for ${title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{title}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleClick}><Play /> Open details</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void toggleWatchlist()} disabled={watchlistToggle.isPending}>
                <ListPlus /> {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              </DropdownMenuItem>
              {mediaType === "movie" && (
                <DropdownMenuItem onSelect={() => void toggleWatched()} disabled={watchedToggle.isPending}>
                  <Check /> {watched ? "Remove from watched" : "Mark as watched"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Card>
    </article>
  );
}

export function MediaCardSkeleton() {
  return (
    <Card className="tvtime-media-card-skeleton overflow-hidden p-0" aria-hidden="true">
      <div className="aspect-[2/3] shimmer" />
      <div className="space-y-2 px-1 pb-1 pt-3">
        <div className="h-3.5 w-4/5 rounded shimmer" />
        <div className="h-3 w-2/5 rounded shimmer" />
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

export function MediaGrid({
  items,
  loading,
  showMediaType = true,
  forcedMediaType,
  libraryStates,
  enableNativeLinks = true,
}: MediaGridProps) {
  const stateRequests = items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
  }));
  const states = useMediaStates(stateRequests, { enabled: libraryStates === undefined });
  const resolvedStates = libraryStates ?? states.data;

  if (loading) {
    return (
      <div className="feedback-grid feedback-grid--loading grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" role="status" aria-busy="true" aria-label="Loading media">
        {Array.from({ length: 12 }).map((_, index) => (
          <MediaCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="tvtime-media-grid grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item, index) => (
        <MediaCard
          key={`${item.id}-${item.media_type || ""}`}
          item={item}
          index={index}
          showMediaType={showMediaType}
          forcedMediaType={forcedMediaType}
          libraryState={resolvedStates?.[mediaStateKey(
            forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
            Number(item.id),
          )] ?? null}
          enableNativeLink={enableNativeLinks}
          priority={index < 4}
        />
      ))}
    </div>
  );
}
