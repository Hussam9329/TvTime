"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/lib/store";
import { useMedia, useMediaUpdate, useLibraryCounts, type MediaItemDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FilterField, FilterGrid, FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Tv, Star, Search, ArrowUpDown, Check, Play, Sparkles, AlertCircle, Clock3, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { RatingDialog } from "@/components/media/rating-dialog";
import { SafeImage } from "@/components/media/safe-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="tvtime-collection-world-page space-y-5">
      {!embedded && (
        <div className="view-page-header flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <WorldIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="view-page-title text-2xl sm:text-3xl font-extrabold tracking-tight">{config.title}</h1>
            <p className="view-page-description text-sm text-muted-foreground mt-0.5">{config.subtitle}</p>
          </div>
        </div>
      )}

      <div className={`grid gap-3 ${world === "anime" ? "max-w-3xl grid-cols-2 sm:grid-cols-4" : "max-w-xl grid-cols-2"}`}>
        <MiniStat label="Watchlist" value={watchlistCount} />
        {world === "anime" && <MiniStat label="Not started" value={notStartedCount} />}
        {world === "anime" && <MiniStat label="In progress" value={watchingCount} />}
        <MiniStat label="Watched" value={watchedCount} />
      </div>

      <FilterPanel
        title="Library filters"
        description={`Browse your ${config.title.toLowerCase()} by collection status, search term and sort order.`}
        activeCount={Number(tab !== "watchlist") + Number(search.trim() !== "") + Number(sortBy !== "addedAt")}
      >
        <FilterSection title="Collection status">
          <Tabs value={tab} onValueChange={(value) => { setTab(value as CollectionTab); setPage(0); }}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="watchlist" className="h-10 min-w-36">
                <WorldIcon className="mr-2 h-4 w-4" />
                Watchlist
                <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchlistCount}</span>
              </TabsTrigger>
              {world === "anime" && (
                <TabsTrigger value="not-started" className="h-10 min-w-36">
                  <Clock3 className="mr-2 h-4 w-4" />
                  Not Started
                  <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{notStartedCount}</span>
                </TabsTrigger>
              )}
              {world === "anime" && (
                <TabsTrigger value="watching" className="h-10 min-w-36">
                  <Play className="mr-2 h-4 w-4" />
                  In Progress
                  <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchingCount}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="watched" className="h-10 min-w-36">
                <Check className="mr-2 h-4 w-4" />
                Watched
                <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchedCount}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </FilterSection>

        <FilterSection title="Search and sort" divided>
          <FilterGrid className="lg:grid-cols-[minmax(0,1fr)_auto]">
            <FilterField label="Search collection">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                  placeholder={config.searchPlaceholder}
                  className="h-9 pl-9"
                />
              </div>
            </FilterField>

            <FilterField label="Sort by">
              <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/25 p-1 lg:min-w-[310px]">
                <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {[
                  { value: "addedAt", label: "Recent" },
                  { value: "userRating", label: "Rating" },
                  { value: "title", label: "A-Z" },
                  { value: "year", label: "Year" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      sortBy === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </FilterField>
          </FilterGrid>
        </FilterSection>
      </FilterPanel>

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
              ? "لا توجد نتائج مطابقة"
              : tab === "watchlist"
                ? `قائمة المشاهدة فارغة`
                : tab === "not-started"
                  ? "لا توجد مسلسلات لم تبدأها بعد"
                  : tab === "watching"
                    ? "لا توجد مسلسلات قيد المشاهدة حالياً"
                    : "لم تتم مشاهدته أي شيء بعد"
          }
          description={
            search
              ? `لم نجد أي عنصر يطابق "${search}". جرب كلمات مختلفة أو امسح البحث.`
              : tab === "watchlist"
                ? `ابدأ بإضافة ${world === "movies" ? "أفلام" : world === "arabic-movies" ? "أفلام عربية" : "أنمي"} من صفحة الاستكشاف.`
                : tab === "watched"
                  ? "اضغط زر 'Mark watched' على أي فيلم لتظهره هنا."
                  : "أضف مسلسلات من صفحة الاستكشاف لتظهر هنا."
          }
          action={
            !search && (
              <Button onClick={() => setView("discover")} size="sm">
                استكشاف المزيد
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
  const hasLibraryMenuActions = isWatchedTab || tab === "watchlist" || item.type === "movie";

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
        className="group"
      >
        <Card className="overflow-hidden p-0 border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 bg-card group">
          <div
            className="relative aspect-[2/3] overflow-hidden bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            onClick={handleOpenDetails}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Open details for ${item.title}${item.year ? ` (${item.year})` : ""}`}
          >
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
                  <><span className="mr-1 text-[11px] font-black">ع</span>{item.type === "movie" ? "Arabic Movie" : "Arabic TV"}</>
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
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t border-border/60 bg-card p-2">
            <Button size="sm" className="h-8 min-w-0 flex-1 px-2 text-xs" onClick={handleOpenDetails}>
              <Play className="mr-1 h-3.5 w-3.5 fill-current" /> Details
            </Button>

            {!isWatchedTab ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => void handleMarkWatched()}
                disabled={update.isPending}
                title={item.type === "series" ? "Open episode tracking" : "Mark watched"}
                aria-label={item.type === "series" ? `Track episodes for ${item.title}` : `Mark ${item.title} as watched`}
              >
                {item.type === "series" ? <Play className="h-3.5 w-3.5 fill-current" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            ) : item.type === "movie" ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => setRatingOpen(true)}
                title={userRating != null ? "Change rating" : "Rate"}
                aria-label={`${userRating != null ? "Change rating for" : "Rate"} ${item.title}`}
              >
                <Star className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => { if (item.tmdbId) goTv(item.tmdbId); else toast.info("Open the show and change released episodes individually."); }}
                title="Open episodes"
                aria-label={`Open episodes for ${item.title}`}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 shrink-0 p-0"
                  aria-label={`More actions for ${item.title}`}
                  title="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{item.title}</DropdownMenuLabel>
                {!isWatchedTab && item.type === "movie" && (
                  <DropdownMenuItem onSelect={() => setRatingOpen(true)}>
                    <Star /> {userRating != null ? "Change rating" : "Rate"}
                  </DropdownMenuItem>
                )}
                {isWatchedTab && userRating != null && (
                  <DropdownMenuItem onSelect={() => void handleRemoveRating()} disabled={update.isPending}>
                    Remove rating
                  </DropdownMenuItem>
                )}
                {tab === "watchlist" && (
                  <DropdownMenuItem variant="destructive" onSelect={() => void handleQuickUnwatch()} disabled={update.isPending}>
                    Remove from watchlist
                  </DropdownMenuItem>
                )}
                {isWatchedTab && (
                  <DropdownMenuItem variant="destructive" onSelect={() => void handleUnwatch()} disabled={update.isPending}>
                    Remove from Watched
                  </DropdownMenuItem>
                )}

                {hasLibraryMenuActions && <DropdownMenuSeparator />}
                {world !== "anime" && (
                  <DropdownMenuItem onSelect={() => void handleMoveWorld("anime")} disabled={update.isPending}>
                    To Anime
                  </DropdownMenuItem>
                )}
                {world !== "arabic-movies" && item.type === "movie" && (
                  <DropdownMenuItem onSelect={() => void handleMoveWorld("arabic")} disabled={update.isPending}>
                    To Arabic Movies
                  </DropdownMenuItem>
                )}
                {world === "anime" && item.type === "series" && (
                  <DropdownMenuItem onSelect={() => void handleMoveWorld("arabic")} disabled={update.isPending}>
                    To Arabic TV
                  </DropdownMenuItem>
                )}
                {(world === "anime" || world === "arabic-movies") && (
                  <DropdownMenuItem onSelect={() => void handleMoveWorld("standard")} disabled={update.isPending}>
                    {item.type === "movie" ? "To Movies" : "To TV Shows"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
