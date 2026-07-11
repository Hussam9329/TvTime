"use client";

import { imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv, Check, ListPlus, Bell } from "lucide-react";
import { useNav } from "@/lib/store";
import { useWatchlist, useWatchedMovies, useFollowing } from "@/hooks/use-tmdb";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SafeImage } from "@/components/media/safe-image";

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  showMediaType?: boolean;
  forcedMediaType?: "movie" | "tv";
}

export function MediaCard({ item, index = 0, showMediaType = true, forcedMediaType }: MediaCardProps) {
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

  // determine library status
  const watchlist = useWatchlist();
  const watchedMovies = useWatchedMovies();
  const following = useFollowing();

  const inWatchlist = watchlist.data?.items.some(
    (w) => w.tmdbId === item.id && w.mediaType === mediaType
  );
  const watched =
    mediaType === "movie"
      ? watchedMovies.data?.items.some((w) => w.tmdbId === item.id)
      : undefined;
  const isFollowing =
    mediaType === "tv" ? following.data?.items.some((w) => w.tmdbId === item.id) : undefined;

  const handleClick = () => {
    // Validate tmdbId before navigating — prevents opening broken profiles
    const id = Number(item.id);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="cursor-pointer group"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${title}${year ? ` (${year})` : ""}`}
    >
      <Card className="overflow-hidden p-0 border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 bg-card">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {/* Blur-up placeholder: tiny image as background */}
          {item.poster_path && (
            <SafeImage
              src={imgOrPlaceholder(item.poster_path, "w92")}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
            />
          )}
          <SafeImage
            src={imgOrPlaceholder(item.poster_path, "w342")}
            alt={title}
            loading="lazy"
            className="relative w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
                {mediaType === "movie" ? "Movie" : "TV"}
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
                <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-500/20 rounded px-1 py-0.5" title="Watched">
                  <Check className="w-2.5 h-2.5" /> Watched
                </span>
              )}
              {isFollowing && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-500/20 rounded px-1 py-0.5" title="Following">
                  <Bell className="w-2.5 h-2.5" /> Following
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
    </motion.div>
  );
}

export function MediaCardSkeleton() {
  return (
    <Card className="overflow-hidden p-0 border-border/50 bg-card">
      <div className="aspect-[2/3] shimmer" />
    </Card>
  );
}

interface MediaGridProps {
  items: MediaItem[];
  loading?: boolean;
  showMediaType?: boolean;
  forcedMediaType?: "movie" | "tv";
}

export function MediaGrid({ items, loading, showMediaType = true, forcedMediaType }: MediaGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {items.map((item, i) => (
        <MediaCard key={`${item.id}-${item.media_type || ""}`} item={item} index={i} showMediaType={showMediaType} forcedMediaType={forcedMediaType} />
      ))}
    </div>
  );
}
