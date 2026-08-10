"use client";

import { imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Star, Film, Tv, Check, ListPlus, Bell, MoreHorizontal, Play } from "lucide-react";
import { useNav } from "@/lib/store";
import { mediaStateKey, useMediaStates, useWatchlistToggle, useWatchedMovieToggle, type MediaBatchState } from "@/hooks/use-tmdb";
import { SafeImage } from "@/components/media/safe-image";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
import { WatchlistIndicator } from "@/components/media/watchlist-indicator";
import { RatingDialog } from "@/components/media/rating-dialog";
import { mediaCollectionWorldForItem } from "@/lib/media-world-pipeline";
import { memo, useMemo, useRef, useState } from "react";
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
  imageSizes?: string;
}

// Single source of truth for card sizing and grid layout.
// Change card presentation here only; parent sections merely place cards.
export const MEDIA_CARD_ROW_WIDTH_CLASS = "w-[130px] sm:w-[160px]";
const MEDIA_CARD_GRID_CLASS = "grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";
export const HOME_MEDIA_CARD_GRID_CLASS = "tvtime-home-media-grid";
const MEDIA_CARD_ROW_IMAGE_SIZES = "(max-width: 639px) 130px, 160px";
const MEDIA_CARD_GRID_IMAGE_SIZES = "(max-width: 479px) 50vw, (max-width: 639px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 20vw, (max-width: 1535px) 17vw, 220px";

export const MediaCard = memo(function MediaCard({ item, showMediaType = true, forcedMediaType, libraryState, libraryStateReady = false, enableNativeLink = true, priority = false, compactActions = true, imageSizes = MEDIA_CARD_ROW_IMAGE_SIZES }: MediaCardProps) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);

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
  const classificationGenres = (item.genre_ids ?? []).map((genreId) =>
    Number(genreId) === 16 ? "Animation" : String(genreId));
  const collectionWorld = mediaCollectionWorldForItem({
    type: mediaType === "tv" ? "series" : "movie",
    title,
    originalLanguage: item.original_language,
    originCountries: item.origin_country,
    genres: classificationGenres,
    isAnime: libraryState?.isAnime,
    isArabic: libraryState?.isArabic,
    classificationComplete: Boolean(item.original_language && classificationGenres.length > 0),
  }, mediaType);
  const typeLabel = collectionWorld === "anime"
    ? "Anime"
    : collectionWorld === "asian-movies" || collectionWorld === "asian-tv"
      ? (mediaType === "movie" ? "Asian Movie" : "Asian TV")
      : collectionWorld === "arabic-movies" || collectionWorld === "arabic-tv"
        ? (mediaType === "movie" ? "Arabic Movie" : "Arabic TV")
        : (mediaType === "movie" ? "Movie" : "TV");

  return (
      <article className="tvtime-media-card group relative min-w-0">
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
              fill
              variant="poster"
              sizes={imageSizes}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              className="tvtime-media-poster__image object-cover"
            />
            <div className="tvtime-media-poster__veil pointer-events-none absolute inset-0" aria-hidden="true" />

            {completed && (
              <WatchedIndicator
                rating={userRating}
                status={finished ? "finished" : "watched"}
              />
            )}

            {!completed && <TmdbScoreIndicator rating={item.vote_average} />}

            {inWatchlist && <WatchlistIndicator />}

            {(isFollowing || (userRating != null && !completed)) && (
              <span className="tvtime-media-state-rail absolute bottom-2 z-10" aria-label="Library status">
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
            <h3 className="tvtime-media-title line-clamp-2 text-start" title={title}>
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
          <MediaCardActions
            item={item}
            id={id}
            title={title}
            mediaType={mediaType}
            inWatchlist={inWatchlist}
            watched={watched}
            userRating={userRating}
            libraryStateReady={libraryStateReady}
            onOpenDetails={handleClick}
          />
        )}
      </article>
  );
});

interface MediaCardActionsProps {
  item: MediaItem;
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  inWatchlist: boolean;
  watched: boolean;
  userRating: number | null;
  libraryStateReady: boolean;
  onOpenDetails: () => void;
}

function MediaCardActions({ item, id, title, mediaType, inWatchlist, watched, userRating, libraryStateReady, onOpenDetails }: MediaCardActionsProps) {
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();
  const showWatchUndo = useWatchUndo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const deferPointerOpen = useRef(false);
  const actionPayload = { tmdbId: id, title, posterPath: item.poster_path, releaseDate: item.release_date || item.first_air_date, voteAverage: item.vote_average, overview: item.overview, genreIds: item.genre_ids, originalLanguage: item.original_language, originCountry: item.origin_country };

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
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="tvtime-media-menu absolute top-2 z-20 h-8 w-8 p-0"
            aria-label={`More actions for ${title}`}
            onPointerDown={(event) => {
              // Radix opens on pointerdown, before the shelf's 5px drag
              // threshold can decide whether this gesture is a click. Defer
              // mouse/pen opening to click; the shelf suppresses that click
              // when the pointer actually dragged. Touch stays native.
              if (event.pointerType === "touch" || event.button !== 0) {
                deferPointerOpen.current = false;
                return;
              }
              deferPointerOpen.current = true;
              event.preventDefault();
            }}
            onPointerCancel={() => {
              deferPointerOpen.current = false;
            }}
            onClick={(event) => {
              if (!deferPointerOpen.current || event.detail === 0) return;
              deferPointerOpen.current = false;
              setMenuOpen((open) => !open);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{title}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onOpenDetails}><Play /> Open details</DropdownMenuItem>
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
      {mediaType === "movie" && ratingOpen && (
        <RatingDialog
          open
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
  libraryStatesReady?: boolean;
  enableNativeLinks?: boolean;
  presentation?: "default" | "home";
  priorityCount?: number;
}

export function MediaGrid({
  items,
  loading,
  showMediaType = true,
  forcedMediaType,
  libraryStates,
  libraryStatesReady,
  enableNativeLinks = true,
  presentation = "default",
  priorityCount = 4,
}: MediaGridProps) {
  const usesExternalLibraryStates = libraryStatesReady !== undefined;
  const stateRequests = useMemo(() => items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
  })), [forcedMediaType, items]);
  const states = useMediaStates(stateRequests, { enabled: !usesExternalLibraryStates });
  const resolvedStates = usesExternalLibraryStates ? libraryStates : states.data;
  const libraryStateReady = libraryStatesReady ?? states.isSuccess;
  const gridClassName = presentation === "home" ? HOME_MEDIA_CARD_GRID_CLASS : MEDIA_CARD_GRID_CLASS;

  if (loading) {
    return (
      <div className={gridClassName} role="status" aria-busy="true" aria-label="Loading media">
        {Array.from({ length: 12 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className={gridClassName}>
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
          priority={i < priorityCount}
          imageSizes={MEDIA_CARD_GRID_IMAGE_SIZES}
        />
      ))}
    </div>
  );
}
