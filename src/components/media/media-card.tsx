"use client";

import { imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv, Check, ListPlus, Bell } from "lucide-react";
import { useNav } from "@/lib/store";
import { mediaStateKey, useMediaStates, type MediaBatchState } from "@/hooks/use-tmdb";
import { motion } from "framer-motion";
import { SafeImage } from "@/components/media/safe-image";
import { isArabicMediaItem } from "@/lib/arabic-media";

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  showMediaType?: boolean;
  forcedMediaType?: "movie" | "tv";
  libraryState?: MediaBatchState | null;
  enableNativeLink?: boolean;
  priority?: boolean;
}

export function MediaCard({ item, index = 0, showMediaType = true, forcedMediaType, libraryState, enableNativeLink = true, priority = false }: MediaCardProps) {
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
      <Card className="overflow-hidden p-0 border-border/50 hover:border-primary/55 transition-[border-color,box-shadow,background-color] duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <SafeImage
            src={imgOrPlaceholder(item.poster_path, "w342")}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="relative w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95"
          />
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />

          {/* top badges */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
            {showMediaType && (
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

          {/* Fix #10: Status indicators moved to bottom-left (next to title)
              to avoid overlap with TMDB score at top-right.
              Each has a text label, not just color. */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {/* Status icons row — above the title, with labels */}
            <div className="flex items-center gap-1.5 mb-1">
              {inWatchlist && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-primary bg-primary/20 rounded px-1 py-0.5" title="In Watchlist">
                  <ListPlus className="w-2.5 h-2.5" /> Watchlist
                </span>
              )}
              {watched && (
                <span data-status="watched" className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-500/20 rounded px-1 py-0.5" title="Watched">
                  <Check className="w-2.5 h-2.5" /> Watched
                </span>
              )}
              {isFollowing && (
                <span data-status="following" className="inline-flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-500/20 rounded px-1 py-0.5" title="Following">
                  <Bell className="w-2.5 h-2.5" /> Following
                </span>
              )}
              {userRating != null && (
                <span data-status="rated" className="inline-flex items-center gap-0.5 text-[9px] text-amber-300 bg-amber-500/20 rounded px-1 py-0.5" title="Your rating">
                  <Star className="w-2.5 h-2.5 fill-current" /> {userRating}/100
                </span>
              )}
            </div>
            <h3 className="font-semibold text-white text-sm line-clamp-2 leading-tight drop-shadow">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {year && <p className="text-white/70 text-xs">{year}</p>}
            </div>
          </div>
        </div>
      </Card>
    </motion.a>
  );
}

export function MediaCardSkeleton() {
  return (
    <Card className="feedback-skeleton overflow-hidden p-0 border-border/50 bg-card" aria-hidden="true">
      <div className="aspect-[2/3] shimmer" />
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
