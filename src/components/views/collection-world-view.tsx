"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/lib/store";
import { useMedia, useMediaUpdate, useLibraryCounts, type MediaItemDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Tv, Star, Search, ArrowUpDown, Check, Play, Sparkles, AlertCircle, Clock3, MoreVertical, Languages } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { RatingDialog } from "@/components/media/rating-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SafeImage } from "@/components/media/safe-image";

export type CollectionWorld = "movies" | "anime" | "arabic-movies";
type CollectionTab = "watchlist" | "not-started" | "watching" | "watched";

type WorldConfig = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  icon: React.ElementType;
  type?: string;
  isAnime: "true" | "false";
  isArabic: "true" | "false";
  watchlistCount: "watchlistMovies" | "watchlistAnime" | "watchlistArabicMovies";
  watchedCount: "watchedMovies" | "watchedAnime" | "watchedArabicMovies";
};

const WORLD_CONFIG: Record<CollectionWorld, WorldConfig> = {
  movies: {
    title: "Movies",
    subtitle: "Your movie watchlist and watched collection",
    searchPlaceholder: "Search your movies...",
    icon: Film,
    type: "movie",
    isAnime: "false",
    isArabic: "false",
    watchlistCount: "watchlistMovies",
    watchedCount: "watchedMovies",
  },
  "arabic-movies": {
    title: "Arabic Movies",
    subtitle: "A dedicated library for Arabic-language cinema, separate from Movies and Anime",
    searchPlaceholder: "Search your Arabic movies...",
    icon: Film,
    type: "movie",
    isAnime: "false",
    isArabic: "true",
    watchlistCount: "watchlistArabicMovies",
    watchedCount: "watchedArabicMovies",
  },
  anime: {
    title: "Anime",
    subtitle: "A separate home for your anime watchlist and watched titles",
    searchPlaceholder: "Search your anime...",
    icon: Sparkles,
    isAnime: "true",
    isArabic: "false",
    watchlistCount: "watchlistAnime",
    watchedCount: "watchedAnime",
  },
};

export function CollectionWorldView({ world, embedded = false }: { world: CollectionWorld; embedded?: boolean }) {
  const config = WORLD_CONFIG[world];
  const WorldIcon = config.icon;
  const setView = useNav((s) => s.setView);
  const [tab, setTab] = useState<CollectionTab>("watchlist");
  const [search, setSearch] = useState("");
  const isArabicWorld = world === "arabic-movies";
  const [sortBy, setSortBy] = useState("addedAt");
  const [page, setPage] = useState(0);
  const limit = 60;
  const isWatchedTab = tab === "watched";
  const isNotStartedTab = tab === "not-started";
  const isWatchingTab = tab === "watching";
  const debouncedSearch = useDebounce(search, 400);

  const media = useMedia({
    type: isWatchingTab || isNotStartedTab ? "series" : config.type,
    isAnime: config.isAnime,
    isArabic: config.isArabic,
    ...(isWatchedTab
      ? { watched: "true" }
      : isNotStartedTab
        ? { status: "not_started", watched: "false", tracked: "true" }
        : isWatchingTab
          ? { status: "watching,uptodate", watched: "false" }
          : { status: "planned", watched: "false" }),
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
  const notStartedCount = world === "anime" ? Number(counts?.notStartedAnime ?? 0) : 0;
  const watchingCount = world === "anime" ? Number(counts?.watchingAnime ?? 0) : 0;
  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <WorldIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{config.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{config.subtitle}</p>
          </div>
        </div>
      )}

      <div className={`grid gap-3 ${world === "anime" ? "max-w-3xl grid-cols-2 sm:grid-cols-4" : "max-w-xl grid-cols-2"}`}>
        <MiniStat label="Watchlist" value={watchlistCount} />
        {world === "anime" && <MiniStat label="Not started" value={notStartedCount} />}
        {world === "anime" && <MiniStat label="In progress" value={watchingCount} />}
        <MiniStat label="Watched" value={watchedCount} />
      </div>

      <Tabs value={tab} onValueChange={(value) => { setTab(value as CollectionTab); setPage(0); }}>
        <TabsList className="w-full sm:w-auto h-auto justify-start overflow-x-auto">
          <TabsTrigger value="watchlist" className="min-w-36 h-10">
            <WorldIcon className="w-4 h-4 mr-2" />
            Watchlist
            <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchlistCount}</span>
          </TabsTrigger>
          {world === "anime" && (
            <TabsTrigger value="not-started" className="min-w-36 h-10">
              <Clock3 className="w-4 h-4 mr-2" />
              Not Started
              <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{notStartedCount}</span>
            </TabsTrigger>
          )}
          {world === "anime" && (
            <TabsTrigger value="watching" className="min-w-36 h-10">
              <Play className="w-4 h-4 mr-2" />
              In Progress
              <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchingCount}</span>
            </TabsTrigger>
          )}
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
        Showing <span className="font-bold text-foreground">{items.length}</span> of <span className="font-bold text-foreground">{total}</span> {world === "movies" ? "movies" : world === "arabic-movies" ? "Arabic movies" : tab === "not-started" ? "anime series not started" : tab === "watching" ? "anime series in progress" : "anime titles"}
      </p>

      {/* Fix #14: Distinguish loading, error, empty, and success states */}
      {media.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] shimmer rounded-lg" />
          ))}
        </div>
      ) : media.isError ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <p className="font-medium text-foreground text-lg">Failed to load your library</p>
          <p className="text-sm text-muted-foreground mt-1">Your data was not deleted. This is a connection error.</p>
          <Button variant="outline" className="mt-4" onClick={() => media.refetch()}>Retry</Button>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<WorldIcon className="w-12 h-12" />}
          title={
            search
              ? isArabicWorld
                ? "لا توجد نتائج مطابقة"
                : "No matching results"
              : tab === "watchlist"
                ? isArabicWorld
                  ? "قائمة المشاهدة فارغة"
                  : "Your watchlist is empty"
                : tab === "not-started"
                  ? isArabicWorld
                    ? "لا توجد مسلسلات لم تبدأها بعد"
                    : "No shows you haven't started yet"
                  : tab === "watching"
                    ? isArabicWorld
                      ? "لا توجد مسلسلات قيد المشاهدة حالياً"
                      : "No shows in progress right now"
                    : isArabicWorld
                      ? "لم تتم مشاهدته أي شيء بعد"
                      : "Nothing watched yet"
          }
          description={
            search
              ? isArabicWorld
                ? `لم نجد أي عنصر يطابق "${search}". جرب كلمات مختلفة أو امسح البحث.`
                : `No items matched "${search}". Try different keywords or clear the search.`
              : tab === "watchlist"
                ? isArabicWorld
                  ? `ابدأ بإضافة ${world === "arabic-movies" ? "أفلام عربية" : "أنمي"} من صفحة الاستكشاف.`
                  : `Start adding ${world === "movies" ? "movies" : "anime"} from the Discover page.`
                : tab === "watched"
                  ? isArabicWorld
                    ? "اضغط زر 'Mark watched' على أي فيلم لتظهره هنا."
                    : "Tap 'Mark watched' on any movie to see it here."
                  : isArabicWorld
                    ? "أضف مسلسلات من صفحة الاستكشاف لتظهر هنا."
                    : "Add shows from Discover to see them here."
          }
          action={
            !search && (
              <Button
                onClick={() => setView(isArabicWorld ? (world === "arabic-movies" ? "arabic-movies" : "arabic-tv") : "discover")}
                size="sm"
              >
                {isArabicWorld ? "استكشاف المزيد" : "Explore more"}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {items.map((item, index) => (
            <CollectionMediaCard key={item.id} item={item} index={index} tab={tab} world={world} />
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

function CollectionMediaCard({ item, index, tab, world }: { item: MediaItemDB; index: number; tab: CollectionTab; world: CollectionWorld }) {
  const isWatchedTab = tab === "watched";
  const update = useMediaUpdate();
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const [ratingOpen, setRatingOpen] = useState(false);

  const publicRating = item.rating ? parseFloat(item.rating) : null;
  const userRating = item.type === "series" && item.status !== "finished"
    ? null
    : item.userRating;

  // Determine media type explicitly from the item's type field — never guess
  const isMovie = item.type === "movie";

  // Navigate to the correct detail page based on type
  const handleOpenDetails = () => {
    const tmdbId = Number(item.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      toast.info("This item doesn't have a valid TMDB profile to open.");
      return;
    }
    if (isMovie) goMovie(tmdbId);
    else goTv(tmdbId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpenDetails();
    }
  };

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

  const handleMoveWorld = async (destination: "standard" | "anime" | "arabic") => {
    if (destination === "anime") {
      await update.mutateAsync({ id: item.id, isAnime: true, isArabic: false });
      toast.success("Moved to Anime");
      return;
    }
    if (destination === "arabic") {
      await update.mutateAsync({ id: item.id, isArabic: true, isAnime: false });
      toast.success(`Moved to ${item.type === "movie" ? "Arabic Movies" : "Arabic TV"}`);
      return;
    }
    await update.mutateAsync({ id: item.id, isAnime: false, isArabic: false });
    toast.success(`Moved to ${item.type === "movie" ? "Movies" : "TV Shows"}`);
  };


  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
        className="cursor-pointer group"
        onClick={handleOpenDetails}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${item.title}${item.year ? ` (${item.year})` : ""}`}
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
                {item.isArabic ? (
                  <><span className="mr-1 text-[11px] font-black text-emerald-400">ع</span><span className="text-emerald-300">{item.type === "movie" ? "Arabic Movie" : "Arabic TV"}</span></>
                ) : item.isAnime ? (
                  <><Sparkles className="w-3 h-3 mr-1 text-purple-400" />Anime</>
                ) : item.type === "movie" ? (
                  <><Film className="w-3 h-3 mr-1" />Movie</>
                ) : (
                  <><Tv className="w-3 h-3 mr-1" />TV</>
                )}
              </Badge>
            </div>

            {/* Fix #8: Rating labels — user rating shows /100, TMDB shows /10 */}
            {userRating != null ? (
              <div className="absolute top-2 right-2">
                <Badge className="bg-amber-500/90 text-black border-0 text-[10px] h-6 px-2 font-bold" title="Your Rating">
                  <Star className="w-3 h-3 mr-1 fill-black" />
                  {userRating}/100
                </Badge>
              </div>
            ) : publicRating != null ? (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-0 text-[10px] h-6 px-2" title="TMDB Score">
                  <Star className="w-3 h-3 mr-1 fill-amber-300" />
                  {publicRating.toFixed(1)}/10
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

            {/* Fix #11: Action buttons visible on touch devices (no hover-only).
                On desktop: opacity-0 → group-hover:opacity-100
                On touch devices: always visible via CSS media query in globals.css (.touch-visible) */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 touch-visible transition-opacity flex items-center justify-center gap-2 p-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {/* Details button — always visible, opens the correct profile */}
              <Button size="sm" className="h-8" onClick={(e) => { e.stopPropagation(); handleOpenDetails(); }}>
                <Play className="w-3.5 h-3.5 mr-1 fill-current" /> Details
              </Button>
              {!isWatchedTab ? (
                <>
                  <Button size="sm" variant="secondary" className="h-8" onClick={(e) => { e.stopPropagation(); void handleMarkWatched(); }} title={item.type === "series" ? "Open episode tracking" : "Mark watched without changing rating"}>
                    {item.type === "series" ? "Track" : "Watched"}
                  </Button>
                  {item.type === "movie" && (
                    <Button size="sm" variant="secondary" className="h-8" onClick={(e) => { e.stopPropagation(); setRatingOpen(true); }}>
                      <Star className="w-3.5 h-3.5 mr-1" /> {userRating != null ? "Re-rate" : "Rate"}
                    </Button>
                  )}
                  {tab === "watchlist" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); e.preventDefault(); void handleQuickUnwatch(); }} title="Remove from watchlist">
                      Remove
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {item.type === "movie" ? (
                    <>
                      <Button size="sm" variant="secondary" className="h-8" onClick={(e) => { e.stopPropagation(); setRatingOpen(true); }}>
                        <Star className="w-3.5 h-3.5 mr-1" /> {userRating != null ? "Re-rate" : "Rate"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); void handleUnwatch(); }}>
                        Unwatch
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      onClick={(e) => { e.stopPropagation(); if (item.tmdbId) goTv(item.tmdbId); else toast.info("Open the show and change released episodes individually."); }}
                    >
                      <Play className="w-3.5 h-3.5 mr-1 fill-current" /> Episodes
                    </Button>
                  )}
                  {userRating != null && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); void handleRemoveRating(); }}>
                      Remove rating
                    </Button>
                  )}
                </>
              )}
              {/* Move-to-world actions consolidated into a single dropdown
                  to reduce visual clutter. Previously 4 separate buttons. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {world !== "anime" && (
                    <DropdownMenuItem onClick={() => void handleMoveWorld("anime")}>
                      <Sparkles className="w-4 h-4 mr-2" /> To Anime
                    </DropdownMenuItem>
                  )}
                  {world !== "arabic-movies" && item.type === "movie" && (
                    <DropdownMenuItem onClick={() => void handleMoveWorld("arabic")}>
                      <Languages className="w-4 h-4 mr-2" /> To Arabic Movies
                    </DropdownMenuItem>
                  )}
                  {world === "anime" && item.type === "series" && (
                    <DropdownMenuItem onClick={() => void handleMoveWorld("arabic")}>
                      <Languages className="w-4 h-4 mr-2" /> To Arabic TV
                    </DropdownMenuItem>
                  )}
                  {(world === "anime" || world === "arabic-movies") && (
                    <DropdownMenuItem onClick={() => void handleMoveWorld("standard")}>
                      <Film className="w-4 h-4 mr-2" /> {item.type === "movie" ? "To Movies" : "To TV Shows"}
                    </DropdownMenuItem>
                  )}
                  {userRating != null && (
                    <DropdownMenuItem onClick={() => void handleRemoveRating()} className="text-rose-400">
                      <Star className="w-4 h-4 mr-2" /> Remove rating
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
        initialRating={item.userRating ?? null}
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
