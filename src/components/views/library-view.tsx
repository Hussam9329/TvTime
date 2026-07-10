"use client";

import { useState, useEffect } from "react";
import { useNav } from "@/lib/store";
import { useMedia, useMediaUpdate, useMediaStats, type MediaItemDB } from "@/hooks/use-tmdb";
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

type LibTab = "watchlist-movies" | "watched-movies" | "watchlist-tv" | "watched-tv" | "watchlist-anime" | "watched-anime";

const TAB_CONFIG: { value: LibTab; label: string; icon: React.ElementType; type: string; isAnime: boolean; isWatched: boolean; states: string }[] = [
  { value: "watchlist-movies", label: "Watchlist Movies", icon: Film, type: "movie", isAnime: false, isWatched: false, states: "planned" },
  { value: "watched-movies", label: "Watched Movies", icon: Check, type: "movie", isAnime: false, isWatched: true, states: "completed" },
  { value: "watchlist-tv", label: "Active TV", icon: Tv, type: "series", isAnime: false, isWatched: false, states: "planned,watching,up_to_date" },
  { value: "watched-tv", label: "Watched TV", icon: Check, type: "series", isAnime: false, isWatched: true, states: "completed" },
  { value: "watchlist-anime", label: "Active Anime", icon: Sparkles, type: "series", isAnime: true, isWatched: false, states: "planned,watching,up_to_date" },
  { value: "watched-anime", label: "Watched Anime", icon: Check, type: "series", isAnime: true, isWatched: true, states: "completed" },
];

export function LibraryView() {
  const [tab, setTab] = useState<LibTab>("watchlist-movies");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("addedAt");
  const [page, setPage] = useState(0);
  const limit = 60;

  const config = TAB_CONFIG.find((t) => t.value === tab)!;

  const debouncedSearch = useDebounce(search, 400);

  const media = useMedia({
    type: config.type,
    isAnime: config.isAnime ? "true" : "false",
    state: config.states,
    search: debouncedSearch || undefined,
    sortBy,
    order: "desc",
    limit,
    offset: page * limit,
  });

  const stats = useMediaStats();

  const items = media.data?.items ?? [];
  const total = media.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Library</h1>
        <p className="text-sm text-muted-foreground mt-1">Your collection from the canonical SQLite library</p>
      </div>

      {/* Stats overview */}
      {stats.data && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <MiniStat label="Watchlist Movies" value={stats.data.counts?.watchlistMovies ?? 0} />
          <MiniStat label="Watched Movies" value={stats.data.counts?.watchedMovies ?? 0} />
          <MiniStat label="Active TV" value={stats.data.counts?.watchlistShows ?? 0} />
          <MiniStat label="Watched TV" value={stats.data.counts?.watchedShows ?? 0} />
          <MiniStat label="Active Anime" value={stats.data.counts?.watchlistAnime ?? 0} />
          <MiniStat label="Watched Anime" value={stats.data.counts?.watchedAnime ?? 0} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as LibTab); setPage(0); }}>
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar h-auto flex-wrap">
          {TAB_CONFIG.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs h-9">
              <t.icon className="w-3.5 h-3.5 mr-1.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search your collection..."
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
          {[
            { v: "addedAt", l: "Recent" },
            { v: "userRating", l: "Rating" },
            { v: "title", l: "A-Z" },
            { v: "year", l: "Year" },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setSortBy(opt.v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === opt.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-bold text-foreground">{items.length}</span> of <span className="font-bold text-foreground">{total}</span> items
      </p>

      {/* Grid */}
      {media.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No items found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {items.map((item, i) => (
            <LibraryMediaCard key={item.id} item={item} index={i} isWatchedTab={config.isWatched} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page + 1}</span> of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
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

function LibraryMediaCard({ item, index, isWatchedTab }: { item: MediaItemDB; index: number; isWatchedTab: boolean }) {
  const update = useMediaUpdate();
  const goTv = useNav((state) => state.goTv);
  const [ratingOpen, setRatingOpen] = useState(false);

  const publicRating = item.rating ? parseFloat(item.rating) : null;
  const userRating = item.userRating;

  const handleMarkWatched = async () => {
    await update.mutateAsync({
      id: item.id,
      libraryState: "completed",
      watchedAt: new Date().toISOString(),
    });
    toast.success("Marked as watched");
    setRatingOpen(true);
  };

  const handleRate = async (rating: number) => {
    await update.mutateAsync({
      id: item.id,
      userRating: rating,
    });
  };

  const handleUnwatch = async () => {
    await update.mutateAsync({
      id: item.id,
      libraryState: "planned",
    });
    toast.success("Moved back to watchlist; rating kept separately");
  };

  // Remove from active tracking without deleting metadata or the independent rating.
  const handleQuickUnwatch = async () => {
    await update.mutateAsync({
      id: item.id,
      libraryState: "none",
    });
    toast.success("Removed from watchlist");
  };

  const handleToggleAnime = async () => {
    await update.mutateAsync({
      id: item.id,
      isAnime: !item.isAnime,
    });
    toast.success(item.isAnime ? "Removed from anime" : "Marked as anime");
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

            {/* rating badge - user rating (watched) or TMDB rating (watchlist) */}
            {isWatchedTab && userRating != null ? (
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
                {isWatchedTab && userRating != null && (
                  <span className="text-amber-400 text-xs font-bold">{userRating}/100</span>
                )}
              </div>
            </div>

            {/* hover action buttons */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
              {!isWatchedTab ? (
                <>
                  {item.type === "series" ? (
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!item.tmdbId}
                      onClick={() => item.tmdbId && goTv(item.tmdbId)}
                      title="Open the episode tracker; series state is derived from episode progress"
                    >
                      <Play className="w-3.5 h-3.5 mr-1 fill-current" /> Track Episodes
                    </Button>
                  ) : (
                    <Button size="sm" className="h-8" onClick={handleMarkWatched} title="Mark this movie as watched; rating remains optional">
                      <Play className="w-3.5 h-3.5 mr-1 fill-current" /> Mark Watched
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleQuickUnwatch(); }} title="Remove from active tracking">
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="secondary" className="h-8" onClick={() => setRatingOpen(true)}>
                    <Star className="w-3.5 h-3.5 mr-1" /> {userRating == null ? "Rate" : "Re-rate"}
                  </Button>
                  {item.type === "series" ? (
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!item.tmdbId} onClick={() => item.tmdbId && goTv(item.tmdbId)}>
                      Episodes
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleUnwatch}>
                      Unwatch
                    </Button>
                  )}
                </>
              )}
              {item.type === "series" && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleToggleAnime}>
                  {item.isAnime ? "TV" : "Anime"}
                </Button>
              )}
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
