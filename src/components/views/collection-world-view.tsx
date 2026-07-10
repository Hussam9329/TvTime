"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/lib/store";
import { useMedia, useMediaUpdate, useLibraryCounts, type MediaItemDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Tv, Star, Search, ArrowUpDown, Check, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { RatingDialog } from "@/components/media/rating-dialog";
import { SafeImage } from "@/components/media/safe-image";

type CollectionWorld = "movies" | "anime";
type CollectionTab = "watchlist" | "watched";

type WorldConfig = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  icon: React.ElementType;
  type?: string;
  isAnime: "true" | "false";
  watchlistCount: "watchlistMovies" | "watchlistAnime";
  watchedCount: "watchedMovies" | "watchedAnime";
};

const WORLD_CONFIG: Record<CollectionWorld, WorldConfig> = {
  movies: {
    title: "Movies",
    subtitle: "Your movie watchlist and watched collection",
    searchPlaceholder: "Search your movies...",
    icon: Film,
    type: "movie",
    isAnime: "false",
    watchlistCount: "watchlistMovies",
    watchedCount: "watchedMovies",
  },
  anime: {
    title: "Anime",
    subtitle: "A separate home for your anime watchlist and watched titles",
    searchPlaceholder: "Search your anime...",
    icon: Sparkles,
    isAnime: "true",
    watchlistCount: "watchlistAnime",
    watchedCount: "watchedAnime",
  },
};

export function CollectionWorldView({ world }: { world: CollectionWorld }) {
  const config = WORLD_CONFIG[world];
  const WorldIcon = config.icon;
  const [tab, setTab] = useState<CollectionTab>("watchlist");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("addedAt");
  const [page, setPage] = useState(0);
  const limit = 60;
  const isWatchedTab = tab === "watched";
  const debouncedSearch = useDebounce(search, 400);

  const media = useMedia({
    type: config.type,
    isAnime: config.isAnime,
    ...(isWatchedTab ? { watched: "true" } : { status: "planned", watched: "false" }),
    search: debouncedSearch || undefined,
    sortBy,
    order: "desc",
    limit,
    offset: page * limit,
  });
  const globalCounts = useLibraryCounts();

  const items = media.data?.items ?? [];
  const total = media.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const counts = globalCounts.data?.counts;
  const watchlistCount = Number(counts?.[config.watchlistCount] ?? 0);
  const watchedCount = Number(counts?.[config.watchedCount] ?? 0);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <WorldIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{config.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{config.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xl">
        <MiniStat label="Watchlist" value={watchlistCount} />
        <MiniStat label="Watched" value={watchedCount} />
      </div>

      <Tabs value={tab} onValueChange={(value) => { setTab(value as CollectionTab); setPage(0); }}>
        <TabsList className="w-full sm:w-auto h-auto">
          <TabsTrigger value="watchlist" className="min-w-36 h-10">
            <WorldIcon className="w-4 h-4 mr-2" />
            Watchlist
            <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchlistCount}</span>
          </TabsTrigger>
          <TabsTrigger value="watched" className="min-w-36 h-10">
            <Check className="w-4 h-4 mr-2" />
            Watched
            <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchedCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder={config.searchPlaceholder}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
          {[
            { value: "addedAt", label: "Recent" },
            { value: "userRating", label: "Rating" },
            { value: "title", label: "A-Z" },
            { value: "year", label: "Year" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-bold text-foreground">{items.length}</span> of <span className="font-bold text-foreground">{total}</span> {world === "movies" ? "movies" : "anime titles"}
      </p>

      {media.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <WorldIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {tab === "watchlist" ? "watchlist" : "watched"} {world === "movies" ? "movies" : "anime"} found</p>
          <p className="text-sm mt-1">Try adjusting your search or add something new</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {items.map((item, index) => (
            <CollectionMediaCard key={item.id} item={item} index={index} isWatchedTab={isWatchedTab} world={world} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
            Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page + 1}</span> of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-2 text-center">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
    </Card>
  );
}

function CollectionMediaCard({ item, index, isWatchedTab, world }: { item: MediaItemDB; index: number; isWatchedTab: boolean; world: CollectionWorld }) {
  const update = useMediaUpdate();
  const goTv = useNav((state) => state.goTv);
  const [ratingOpen, setRatingOpen] = useState(false);

  const publicRating = item.rating ? parseFloat(item.rating) : null;
  const userRating = item.type === "series" && item.status !== "finished"
    ? null
    : item.userRating;

  const handleMarkWatched = async () => {
    if (item.type === "series") {
      if (item.tmdbId) goTv(item.tmdbId);
      else toast.info("Open the show and track released episodes individually.");
      return;
    }
    await update.mutateAsync({
      id: item.id,
      watched: true,
      watchedAt: new Date().toISOString(),
      status: "watched",
    });
    toast.success("Marked as watched. Rating was not changed.");
  };

  const handleRate = async (rating: number) => {
    await update.mutateAsync({ id: item.id, userRating: rating });
  };

  const handleRemoveRating = async () => {
    await update.mutateAsync({ id: item.id, userRating: null });
    toast.success("Rating removed. Watch status was not changed.");
  };

  const handleUnwatch = async () => {
    await update.mutateAsync({
      id: item.id,
      watched: false,
      watchedAt: null,
      status: null,
    });
    toast.success("Removed from Watched. Rating was preserved.");
  };

  // Quick remove from watchlist — clears status only, doesn't touch watched/rating.
  // Used on watchlist items where the user wants to remove the movie entirely.
  const handleQuickUnwatch = async () => {
    await update.mutateAsync({
      id: item.id,
      status: null,
    });
    toast.success("Removed from watchlist");
  };

  const handleMoveWorld = async () => {
    await update.mutateAsync({ id: item.id, isAnime: world !== "anime" });
    const destination = world === "anime"
      ? (item.type === "movie" ? "Movies" : "TV Shows")
      : "Anime";
    toast.success(`Moved to ${destination}`);
  };


  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      >
        <Card className="overflow-hidden p-0 border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 bg-card group">
          <div className="relative aspect-[2/3] overflow-hidden bg-muted">
            {item.poster ? (
              <SafeImage src={item.poster} alt={item.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {item.type === "movie" ? <Film className="w-12 h-12" /> : <Tv className="w-12 h-12" />}
              </div>
            )}
            {/* gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />

            {/* type badge */}
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-black/60 backdrop-blur border-0 text-[10px] h-6 px-2">
                {item.isAnime ? (
                  <><Sparkles className="w-3 h-3 mr-1 text-purple-400" />Anime</>
                ) : item.type === "movie" ? (
                  <><Film className="w-3 h-3 mr-1" />Movie</>
                ) : (
                  <><Tv className="w-3 h-3 mr-1" />TV</>
                )}
              </Badge>
            </div>

            {/* A rating is independent and may exist on either tab. */}
            {userRating != null ? (
              <div className="absolute top-2 right-2">
                <Badge className="bg-amber-500/90 text-black border-0 text-[10px] h-6 px-2 font-bold">
                  <Star className="w-3 h-3 mr-1 fill-black" />
                  {userRating}
                </Badge>
              </div>
            ) : publicRating != null ? (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-0 text-[10px] h-6 px-2">
                  <Star className="w-3 h-3 mr-1 fill-amber-300" />
                  {publicRating.toFixed(1)}
                </Badge>
              </div>
            ) : null}

            {/* bottom title */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="font-semibold text-white text-sm line-clamp-2 leading-tight drop-shadow">{item.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {item.year && <p className="text-white/70 text-xs">{item.year}</p>}
                {userRating != null && (
                  <span className="text-amber-400 text-xs font-bold">{userRating}/100</span>
                )}
              </div>
            </div>

            {/* hover action buttons */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
              {!isWatchedTab ? (
                <>
                  <Button size="sm" className="h-8" onClick={handleMarkWatched} title={item.type === "series" ? "Open episode tracking" : "Mark watched without changing rating"}>
                    <Play className="w-3.5 h-3.5 mr-1 fill-current" /> {item.type === "series" ? "Track Episodes" : "Mark Watched"}
                  </Button>
                  {item.type === "movie" && (
                    <Button size="sm" variant="secondary" className="h-8" onClick={() => setRatingOpen(true)}>
                      <Star className="w-3.5 h-3.5 mr-1" /> {userRating != null ? "Re-rate" : "Rate"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleQuickUnwatch(); }} title="Remove from watchlist">
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  {item.type === "movie" ? (
                    <>
                      <Button size="sm" variant="secondary" className="h-8" onClick={() => setRatingOpen(true)}>
                        <Star className="w-3.5 h-3.5 mr-1" /> {userRating != null ? "Re-rate" : "Rate"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleUnwatch}>
                        Unwatch
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      onClick={() => item.tmdbId ? goTv(item.tmdbId) : toast.info("Open the show and change released episodes individually.")}
                    >
                      <Play className="w-3.5 h-3.5 mr-1 fill-current" /> Episodes
                    </Button>
                  )}
                  {userRating != null && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleRemoveRating}>
                      Remove rating
                    </Button>
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={(event) => { event.stopPropagation(); void handleMoveWorld(); }}
                title={world === "anime" ? "Move out of Anime" : "Move to Anime"}
              >
                {world === "anime" ? (item.type === "movie" ? "To Movies" : "To TV Shows") : "To Anime"}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <RatingDialog
        open={ratingOpen}
        onOpenChange={setRatingOpen}
        title={item.title}
        poster={item.poster}
        onRate={handleRate}
      />
    </>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
