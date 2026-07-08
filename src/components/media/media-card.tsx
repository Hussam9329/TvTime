"use client";

import { imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv, Check } from "lucide-react";
import { useNav } from "@/lib/store";
import { useWatchlist, useWatchedMovies, useFollowing } from "@/hooks/use-tmdb";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SafeImage } from "@/components/media/safe-image";

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  showMediaType?: boolean;
}

export function MediaCard({ item, index = 0, showMediaType = true }: MediaCardProps) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);

  const mediaType: "movie" | "tv" =
    item.media_type === "movie" || item.media_type === "tv"
      ? item.media_type
      : item.title
      ? "movie"
      : "tv";

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
    if (mediaType === "movie") goMovie(item.id);
    else goTv(item.id);
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
            {rating > 0 && (
              <Badge className="bg-black/60 backdrop-blur text-amber-300 border-0 text-[10px] h-6 px-2">
                <Star className="w-3 h-3 mr-1 fill-amber-300" />
                {rating.toFixed(1)}
              </Badge>
            )}
          </div>

          {/* status indicators */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {inWatchlist && (
              <span className="w-6 h-6 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center" title="In watchlist">
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </span>
            )}
            {watched && (
              <span className="w-6 h-6 rounded-full bg-emerald-600/90 backdrop-blur flex items-center justify-center" title="Watched">
                <Check className="w-3.5 h-3.5 text-white" />
              </span>
            )}
            {isFollowing && (
              <span className="w-6 h-6 rounded-full bg-amber-500/90 backdrop-blur flex items-center justify-center text-[10px] font-bold text-black" title="Following">
                ★
              </span>
            )}
          </div>

          {/* bottom title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-semibold text-white text-sm line-clamp-2 leading-tight drop-shadow">
              {title}
            </h3>
            {year && <p className="text-white/70 text-xs mt-0.5">{year}</p>}
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
}

export function MediaGrid({ items, loading, showMediaType = true }: MediaGridProps) {
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
        <MediaCard key={`${item.id}-${item.media_type || ""}`} item={item} index={i} showMediaType={showMediaType} />
      ))}
    </div>
  );
}
