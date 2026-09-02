"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNav } from "@/lib/store";
import { useMedia, useMediaUpdate, useLibraryCounts, type MediaItemDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FilterField, FilterGrid, FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Tv, Star, Search, ArrowUpDown, Check, Play, Sparkles, AlertCircle, Clock3, MoreHorizontal, Grid2X2, List, SlidersHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { RatingDialog } from "@/components/media/rating-dialog";
import { SafeImage } from "@/components/media/safe-image";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
import { WatchlistIndicator } from "@/components/media/watchlist-indicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { HOME_MEDIA_CARD_GRID_CLASS, MediaCardSkeleton } from "@/components/media/media-card";
import { pickArabicTitle } from "@/lib/tmdb";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";

type CollectionWorld = "movies" | "asian-movies" | "anime" | "arabic-movies";
type CollectionTab = "watchlist" | "not-started" | "watching" | "watched";

const MIN_LIBRARY_YEAR = 1800;
const MAX_LIBRARY_YEAR_OFFSET = 25;

const MOVIE_GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
  "Romance", "Science Fiction", "TV Movie", "Thriller", "War", "Western",
] as const;

type WorldConfig = {
  title: string;
  searchPlaceholder: string;
  icon: React.ElementType;
  type?: string;
  isAnime: "true" | "false";
  isArabic: "true" | "false";
  isAsian: "true" | "false";
  watchlistCount: "watchlistMovies" | "watchlistAsianMovies" | "watchlistAnime" | "watchlistArabicMovies";
  watchedCount: "watchedMovies" | "watchedAsianMovies" | "watchedAnime" | "watchedArabicMovies";
};

const WORLD_CONFIG: Record<CollectionWorld, WorldConfig> = {
  movies: {
    title: "Movies",
    searchPlaceholder: "Search your movies...",
    icon: Film,
    type: "movie",
    isAnime: "false",
    isArabic: "false",
    isAsian: "false",
    watchlistCount: "watchlistMovies",
    watchedCount: "watchedMovies",
  },
  "asian-movies": {
    title: "Asian Movies",
    searchPlaceholder: "Search your Asian movies...",
    icon: Film,
    type: "movie",
    isAnime: "false",
    isArabic: "false",
    isAsian: "true",
    watchlistCount: "watchlistAsianMovies",
    watchedCount: "watchedAsianMovies",
  },
  "arabic-movies": {
    title: "الأفلام العربية",
    searchPlaceholder: "ابحث في أفلامك العربية...",
    icon: Film,
    type: "movie",
    isAnime: "false",
    isArabic: "true",
    isAsian: "false",
    watchlistCount: "watchlistArabicMovies",
    watchedCount: "watchedArabicMovies",
  },
  anime: {
    title: "Anime",
    searchPlaceholder: "Search your anime...",
    icon: Sparkles,
    isAnime: "true",
    isArabic: "false",
    isAsian: "false",
    watchlistCount: "watchlistAnime",
    watchedCount: "watchedAnime",
  },
};

export function CollectionWorldView({ world, embedded = false, onDiscover }: { world: CollectionWorld; embedded?: boolean; onDiscover?: () => void }) {
  const animeTypeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const infiniteSentinelRef = useRef<HTMLDivElement>(null);
  const isMobileViewport = useMobileViewport();
  const queryClient = useQueryClient();
  const config = WORLD_CONFIG[world];
  const WorldIcon = config.icon;
  const setView = useNav((s) => s.setView);
  const savedUi = useNav((s) => s.collectionUi[world]);
  const persistUi = useNav((s) => s.setCollectionUi);
  const maxLibraryYear = new Date().getFullYear() + MAX_LIBRARY_YEAR_OFFSET;
  const [tab, setTab] = useState<CollectionTab>(savedUi?.tab ?? "watchlist");
  const [search, setSearch] = useState(savedUi?.search ?? "");
  const [sortBy, setSortBy] = useState(savedUi?.sortBy ?? "smart");
  const [filterGenre, setFilterGenre] = useState(savedUi?.filterGenre ?? "");
  const [yearRange, setYearRange] = useState<[number, number]>(savedUi?.yearRange ?? [MIN_LIBRARY_YEAR, maxLibraryYear]);
  const [tmdbRatingRange, setTmdbRatingRange] = useState<[number, number]>(savedUi?.tmdbRatingRange ?? [0, 10]);
  const [userRatingRange, setUserRatingRange] = useState<[number, number]>(savedUi?.userRatingRange ?? [0, 100]);
  const [layout, setLayout] = useState<"grid" | "list">(savedUi?.layout ?? "grid");
  const [animeMediaKind, setAnimeMediaKind] = useState<"all" | "movie" | "series">(savedUi?.animeMediaKind ?? "all");
  const [page, setPage] = useState(savedUi?.page ?? 0);
  const initialSavedPageRef = useRef(savedUi?.page ?? 0);
  const mobileRestoreTargetRef = useRef(-1);
  const mobileRestoreInitializedRef = useRef(false);
  const [mobileAccumulatedItems, setMobileAccumulatedItems] = useState<MediaItemDB[]>([]);
  const limit = 60;
  const isWatchedTab = tab === "watched";
  const isArabicWorld = world === "arabic-movies";
  const isNotStartedTab = tab === "not-started";
  const isWatchingTab = tab === "watching";
  const animeTypeVisible = world === "anime" && !isNotStartedTab && !isWatchingTab;
  const collectionRailKey = `collection:${embedded ? "embedded" : "standalone"}:${world}`;
  const animeTypeDragHandlers = useHorizontalDragScroll({
    scrollKey: animeTypeVisible ? `${collectionRailKey}:anime-type` : undefined,
    scrollRef: animeTypeRef,
    restoreDependency: animeTypeVisible,
  });
  const statusDragHandlers = useHorizontalDragScroll({
    scrollKey: `${collectionRailKey}:status`,
    scrollRef: statusRef,
  });
  const debouncedSearch = useDebounce(search, 400);
  const debouncedYearRange = useDebounce(yearRange, 250);
  const debouncedTmdbRatingRange = useDebounce(tmdbRatingRange, 250);
  const debouncedUserRatingRange = useDebounce(userRatingRange, 250);
  const layoutStorageKey = world === "anime" ? "trakora:anime-library-layout" : "trakora:movie-library-layout";
  const isMovieWorld = world === "movies" || world === "arabic-movies" || world === "asian-movies";
  const genreOptions = MOVIE_GENRES;

  useEffect(() => {
    const saved = window.localStorage.getItem(layoutStorageKey);
    if (saved === "grid" || saved === "list") setLayout(saved);
  }, [layoutStorageKey]);

  const changeLayout = (next: "grid" | "list") => {
    setLayout(next);
    window.localStorage.setItem(layoutStorageKey, next);
  };

  useEffect(() => {
    persistUi(world, { tab, search, sortBy, filterGenre: filterGenre || undefined, yearRange, tmdbRatingRange, userRatingRange, layout, animeMediaKind, page });
  }, [animeMediaKind, filterGenre, layout, page, persistUi, search, sortBy, tab, tmdbRatingRange, userRatingRange, world, yearRange]);

  const resetFilters = () => {
    setTab("watchlist");
    setSearch("");
    setSortBy("smart");
    setFilterGenre("");
    setYearRange([MIN_LIBRARY_YEAR, maxLibraryYear]);
    setTmdbRatingRange([0, 10]);
    setUserRatingRange([0, 100]);
    setAnimeMediaKind("all");
    setPage(0);
  };

  const mediaParams = useMemo(() => ({
    collectionWorld: world,
    type: isWatchingTab || isNotStartedTab
      ? "series"
      : world === "anime" && animeMediaKind !== "all"
        ? animeMediaKind
        : config.type,
    isAnime: config.isAnime,
    isArabic: config.isArabic,
    isAsian: config.isAsian,
    ...(isWatchedTab
      ? { watched: "true" }
      : isNotStartedTab
        ? { status: "not_started", watched: "false", tracked: "true" }
        : isWatchingTab
          ? { status: "watching,uptodate", watched: "false" }
          : { status: "planned", watched: "false" }),
    search: debouncedSearch || undefined,
    genre: isMovieWorld && filterGenre ? filterGenre : undefined,
    sortBy: sortBy === "smart" ? (isWatchedTab ? "watchedAt" : "addedAt") : sortBy,
    order: sortBy === "title" ? "asc" : "desc",
    ...(isMovieWorld && sortBy === "year" && (debouncedYearRange[0] !== MIN_LIBRARY_YEAR || debouncedYearRange[1] !== maxLibraryYear)
      ? { yearFrom: debouncedYearRange[0], yearTo: debouncedYearRange[1] } : {}),
    ...(isMovieWorld && sortBy === "tmdbRating" && (debouncedTmdbRatingRange[0] !== 0 || debouncedTmdbRatingRange[1] !== 10)
      ? { ratingFrom: debouncedTmdbRatingRange[0], ratingTo: debouncedTmdbRatingRange[1] } : {}),
    ...(isMovieWorld && sortBy === "userRating" && (debouncedUserRatingRange[0] !== 0 || debouncedUserRatingRange[1] !== 100)
      ? { userRatingFrom: debouncedUserRatingRange[0], userRatingTo: debouncedUserRatingRange[1] } : {}),
    limit,
    offset: page * limit,
  }), [animeMediaKind, config.isAnime, config.isArabic, config.isAsian, config.type, debouncedSearch, debouncedTmdbRatingRange, debouncedUserRatingRange, debouncedYearRange, filterGenre, isMovieWorld, isNotStartedTab, isWatchingTab, isWatchedTab, maxLibraryYear, page, sortBy, tab, world]);
  const media = useMedia(mediaParams);
  const globalCounts = useLibraryCounts();

  const items = media.data?.items ?? [];
  const total = media.data?.total ?? 0;
  const filterIdentity = [world, tab, debouncedSearch, filterGenre, sortBy, debouncedYearRange.join("-"), debouncedTmdbRatingRange.join("-"), debouncedUserRatingRange.join("-"), animeMediaKind].join("|");
  const mediaCoreIdentity = useMemo(() => {
    const { offset: _offset, limit: _limit, ...core } = mediaParams;
    return JSON.stringify(core);
  }, [mediaParams]);
  const initialFilterIdentityRef = useRef(filterIdentity);

  useEffect(() => {
    if (filterIdentity !== initialFilterIdentityRef.current) mobileRestoreTargetRef.current = -1;
  }, [filterIdentity]);

  useEffect(() => {
    if (!isMobileViewport || mobileRestoreInitializedRef.current) return;
    mobileRestoreInitializedRef.current = true;
    const targetPage = initialSavedPageRef.current;
    if (targetPage <= 0) return;
    const cachedOffsets = new Set<number>();
    for (const [key, data] of queryClient.getQueriesData({ queryKey: ["media", "list"] })) {
      const queryKey = key as unknown as [string, string, Record<string, unknown>];
      const params = queryKey[2];
      if (!params || !data) continue;
      const { offset: cachedOffset, limit: _cachedLimit, ...cachedCore } = params;
      if (JSON.stringify(cachedCore) === mediaCoreIdentity) cachedOffsets.add(Number(cachedOffset || 0));
    }
    const hasEveryPage = Array.from({ length: targetPage + 1 }, (_, index) => index * limit).every((offset) => cachedOffsets.has(offset));
    if (!hasEveryPage) {
      mobileRestoreTargetRef.current = targetPage;
      setMobileAccumulatedItems([]);
      setPage(0);
    }
  }, [isMobileViewport, mediaCoreIdentity, queryClient]);

  useEffect(() => {
    setMobileAccumulatedItems([]);
  }, [filterIdentity]);

  useEffect(() => {
    if (!isMobileViewport || !media.data) return;
    const cachedPages: Array<{ offset: number; items: MediaItemDB[] }> = [];
    for (const [key, data] of queryClient.getQueriesData<{ items: MediaItemDB[]; total: number; limit: number; offset: number }>({ queryKey: ["media", "list"] })) {
      const queryKey = key as unknown as [string, string, Record<string, unknown>];
      const params = queryKey[2];
      if (!params || !data) continue;
      const { offset: cachedOffset, limit: _cachedLimit, ...cachedCore } = params;
      if (JSON.stringify(cachedCore) !== mediaCoreIdentity) continue;
      const numericOffset = Number(cachedOffset || 0);
      if (numericOffset <= page * limit) cachedPages.push({ offset: numericOffset, items: data.items });
    }
    cachedPages.sort((a, b) => a.offset - b.offset);
    const byId = new Map<string, MediaItemDB>();
    for (const cached of cachedPages) for (const item of cached.items) byId.set(item.id, item);
    for (const item of media.data.items) byId.set(item.id, item);
    setMobileAccumulatedItems(Array.from(byId.values()));

    const restoreTarget = mobileRestoreTargetRef.current;
    if (restoreTarget >= 0 && page < restoreTarget && !media.isFetching) {
      setPage((current) => Math.min(current + 1, restoreTarget));
    } else if (restoreTarget >= 0 && page >= restoreTarget) {
      mobileRestoreTargetRef.current = -1;
    }
  }, [isMobileViewport, media.data, media.isFetching, mediaCoreIdentity, page, queryClient]);

  const visibleItems = isMobileViewport
    ? (mobileAccumulatedItems.length > 0 ? mobileAccumulatedItems : items)
    : items;
  const totalPages = Math.ceil(total / limit);
  const hasMoreMobile = isMobileViewport && visibleItems.length < total;
  const counts = globalCounts.data?.counts;
  const watchlistCount = Number(counts?.[config.watchlistCount] ?? 0);
  const watchedCount = Number(counts?.[config.watchedCount] ?? 0);
  const notStartedCount = world === "anime" ? Number(counts?.notStartedAnime ?? 0) : 0;
  const watchingCount = world === "anime" ? Number(counts?.watchingAnime ?? 0) : 0;
  const usesHomePosterGrid = (isMovieWorld || world === "anime") && layout === "grid";

  useEffect(() => {
    if (!isMobileViewport || !hasMoreMobile) return;
    const target = infiniteSentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !media.isFetching) {
        setPage((current) => Math.min(current + 1, Math.max(0, totalPages - 1)));
      }
    }, { rootMargin: "500px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreMobile, isMobileViewport, media.isFetching, totalPages]);

  const activeFilterCount = Number(tab !== "watchlist") + Number(search.trim() !== "") + Number(sortBy !== "smart")
    + Number(isMovieWorld && filterGenre !== "")
    + Number(world === "anime" && animeMediaKind !== "all")
    + Number(isMovieWorld && sortBy === "year" && (yearRange[0] !== MIN_LIBRARY_YEAR || yearRange[1] !== maxLibraryYear))
    + Number(isMovieWorld && sortBy === "tmdbRating" && (tmdbRatingRange[0] !== 0 || tmdbRatingRange[1] !== 10))
    + Number(isMovieWorld && sortBy === "userRating" && (userRatingRange[0] !== 0 || userRatingRange[1] !== 100));
  const openMobileFilters = () => window.dispatchEvent(new Event("tvtime:open-filters"));

  return (
    <div className="tvtime-collection-world-page space-y-5">
      {!embedded && (
        <PageTitlebar title={config.title} />
      )}

      <div className={`grid gap-3 ${world === "anime" ? "max-w-3xl grid-cols-2 sm:grid-cols-4" : "max-w-xl grid-cols-2"}`}>
        <MiniStat label={isArabicWorld ? "قائمة المشاهدة" : "Watchlist"} value={watchlistCount} />
        {world === "anime" && <MiniStat label="Not started" value={notStartedCount} />}
        {world === "anime" && <MiniStat label="In progress" value={watchingCount} />}
        <MiniStat label={isArabicWorld ? "تمت مشاهدتها" : "Watched"} value={watchedCount} />
      </div>

      <FilterPanel
        title={isArabicWorld ? "فلاتر المكتبة" : "Library filters"}
        description={isArabicWorld ? "تصفّح أفلامك العربية حسب حالة المجموعة والبحث والترتيب." : `Browse your ${config.title.toLowerCase()} by collection status, search term and sort order.`}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        resetLabel={isArabicWorld ? "إعادة الضبط" : "Reset all"}
        mobileSheet
        mobileResultLabel={isArabicWorld ? `عرض ${total} فيلم` : `Show ${total} titles`}
      >
        {world === "anime" && !isNotStartedTab && !isWatchingTab && (
          <FilterSection title="Anime type">
            <div
              ref={animeTypeRef}
              {...animeTypeDragHandlers}
              className="tvtime-anime-library-type"
              role="group"
              aria-label="Filter Anime library by media type"
              tabIndex={0}
            >
              {[
                { value: "all", label: "All", icon: Sparkles },
                { value: "series", label: "Series", icon: Tv },
                { value: "movie", label: "Movies", icon: Film },
              ].map((option) => {
                const Icon = option.icon;
                const active = animeMediaKind === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    data-active={active ? "true" : "false"}
                    onClick={() => { setAnimeMediaKind(option.value as typeof animeMediaKind); setPage(0); }}
                  >
                    <Icon aria-hidden="true" /> {option.label}
                  </button>
                );
              })}
            </div>
          </FilterSection>
        )}

        <FilterSection title={isArabicWorld ? "حالة المجموعة" : "Collection status"}>
          <Tabs value={tab} onValueChange={(value) => { setTab(value as CollectionTab); setPage(0); }}>
            <TabsList
              ref={statusRef}
              {...statusDragHandlers}
              className="tvtime-collection-status-tabs h-auto w-full justify-start overflow-x-auto"
              aria-label={isArabicWorld ? "حالة المجموعة" : "Collection status horizontal list"}
            >
              <TabsTrigger value="watchlist" className="h-10 min-w-36">
                <WorldIcon className="mr-2 h-4 w-4" />
                {isArabicWorld ? "قائمة المشاهدة" : "Watchlist"}
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
                {isArabicWorld ? "تمت مشاهدتها" : "Watched"}
                <span className="ml-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums">{watchedCount}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </FilterSection>

        {isMovieWorld && (
          <FilterSection title={isArabicWorld ? "النوع" : "Genre"} divided>
            <FilterField label={isArabicWorld ? "نوع الفيلم" : "Movie genre"}>
              <Select value={filterGenre || "all"} onValueChange={(value) => { setFilterGenre(value === "all" ? "" : value); setPage(0); }}>
                <SelectTrigger className="h-9 w-full max-w-sm text-sm" aria-label={isArabicWorld ? "تصفية الأفلام حسب النوع" : "Filter movies by genre"}>
                  <SelectValue placeholder={isArabicWorld ? "كل الأنواع" : "All genres"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isArabicWorld ? "كل الأنواع" : "All genres"}</SelectItem>
                  {genreOptions.map((genre) => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </FilterSection>
        )}

        <FilterSection title={isArabicWorld ? "البحث والترتيب" : "Search and sort"} divided>
          <FilterGrid className="lg:grid-cols-[minmax(0,1fr)_auto]">
            <FilterField label={isArabicWorld ? "البحث في المجموعة" : "Search collection"}>
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

            <FilterField label={isArabicWorld ? "الترتيب حسب" : "Sort by"}>
              <div className="tvtime-collection-sort-options flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/25 p-1 lg:min-w-[310px]">
                <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {[
                  { value: "smart", label: isArabicWorld ? "ذكي" : "Smart" },
                  { value: "addedAt", label: isArabicWorld ? "الأحدث إضافة" : "Recent" },
                  { value: "tmdbRating", label: isArabicWorld ? "تقييم TMDB" : "TMDB Rating" },
                  { value: "userRating", label: isArabicWorld ? "تقييمي" : "My Rating" },
                  { value: "title", label: isArabicWorld ? "أ-ي" : "A-Z" },
                  { value: "year", label: isArabicWorld ? "السنة" : "Year" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setPage(0); }}
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

          {isMovieWorld && sortBy === "year" && (
            <RangeFilter
              label={isArabicWorld ? "نطاق السنة" : "Year range"}
              fromLabel={isArabicWorld ? "من سنة" : "From year"}
              toLabel={isArabicWorld ? "إلى سنة" : "To year"}
              min={MIN_LIBRARY_YEAR}
              max={maxLibraryYear}
              step={1}
              value={yearRange}
              presets={[
                { label: "2020+", value: [2020, maxLibraryYear] },
                { label: "2010s", value: [2010, 2019] },
                { label: "2000s", value: [2000, 2009] },
              ]}
              onChange={(next) => { setYearRange(next); setPage(0); }}
            />
          )}

          {isMovieWorld && sortBy === "tmdbRating" && (
            <RangeFilter
              label={isArabicWorld ? "نطاق تقييم TMDB" : "TMDB rating range"}
              fromLabel={isArabicWorld ? "من تقييم" : "From rating"}
              toLabel={isArabicWorld ? "إلى تقييم" : "To rating"}
              min={0}
              max={10}
              step={0.1}
              suffix="/10"
              value={tmdbRatingRange}
              presets={[
                { label: "8+", value: [8, 10] },
                { label: "7+", value: [7, 10] },
                { label: "6+", value: [6, 10] },
                { label: "All", value: [0, 10] },
              ]}
              onChange={(next) => { setTmdbRatingRange(next); setPage(0); }}
            />
          )}


          {isMovieWorld && sortBy === "userRating" && (
            <RangeFilter
              label={isArabicWorld ? "نطاق تقييمي" : "My rating range"}
              fromLabel={isArabicWorld ? "من تقييم" : "From rating"}
              toLabel={isArabicWorld ? "إلى تقييم" : "To rating"}
              min={0}
              max={100}
              step={1}
              suffix="/100"
              value={userRatingRange}
              presets={[
                { label: "90+", value: [90, 100] },
                { label: "80+", value: [80, 100] },
                { label: "70+", value: [70, 100] },
                { label: "All", value: [0, 100] },
              ]}
              onChange={(next) => { setUserRatingRange(next); setPage(0); }}
            />
          )}
        </FilterSection>
      </FilterPanel>

      <div className="tvtime-mobile-library-toolbar tvtime-mobile-experience-only" role="toolbar" aria-label={isArabicWorld ? "أدوات المكتبة" : "Library tools"}>
        <div className="tvtime-mobile-library-toolbar__tabs">
          <button type="button" data-active={tab === "watchlist" ? "true" : "false"} onClick={() => { setTab("watchlist"); setPage(0); }}>
            {isArabicWorld ? "القائمة" : "Watchlist"}
          </button>
          <button type="button" data-active={tab === "watched" ? "true" : "false"} onClick={() => { setTab("watched"); setPage(0); }}>
            {isArabicWorld ? "شاهدتها" : "Watched"}
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={openMobileFilters}>
          <SlidersHorizontal className="h-4 w-4" />
          {isArabicWorld ? `فلتر${activeFilterCount ? ` · ${activeFilterCount}` : ""}` : `Filters${activeFilterCount ? ` · ${activeFilterCount}` : ""}`}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {isArabicWorld ? "يُعرض" : "Showing"} <span className="font-bold text-foreground">{visibleItems.length}</span> {isArabicWorld ? "من" : "of"} <span className="font-bold text-foreground">{total}</span> {world === "movies" ? "movies" : world === "asian-movies" ? "Asian movies" : world === "arabic-movies" ? "فيلماً عربياً" : tab === "not-started" ? "anime series not started" : tab === "watching" ? "anime series in progress" : animeMediaKind === "movie" ? "anime movies" : animeMediaKind === "series" ? "anime series" : "anime titles"}
      </p>
      <div className="flex justify-end gap-1" aria-label={isArabicWorld ? "طريقة عرض المكتبة" : "Library layout"}>
        <Button size="icon" variant={layout === "grid" ? "default" : "outline"} className="h-8 w-8" onClick={() => changeLayout("grid")} title={isArabicWorld ? "شبكة البوسترات" : "Poster grid"}><Grid2X2 className="h-4 w-4" /></Button>
        <Button size="icon" variant={layout === "list" ? "default" : "outline"} className="h-8 w-8" onClick={() => changeLayout("list")} title={isArabicWorld ? "قائمة مختصرة" : "Compact list"}><List className="h-4 w-4" /></Button>
      </div>

      {/* Fix #14: Distinguish loading, error, empty, and success states */}
      {media.isLoading && visibleItems.length === 0 ? (
        <div className={usesHomePosterGrid ? HOME_MEDIA_CARD_GRID_CLASS : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"}>
          {Array.from({ length: 12 }).map((_, index) => (
            usesHomePosterGrid
              ? <MediaCardSkeleton key={index} />
              : <div key={index} className="aspect-[2/3] shimmer rounded-lg" />
          ))}
        </div>
      ) : media.isError ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <p className="font-medium text-foreground text-lg">Failed to load your library</p>
          <p className="text-sm text-muted-foreground mt-1">Your data was not deleted. This is a connection error.</p>
          <Button variant="outline" className="mt-4" onClick={() => media.refetch()}>Retry</Button>
        </Card>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<WorldIcon className="w-12 h-12" />}
          title={
            search
              ? (isArabicWorld ? "لا توجد نتائج مطابقة" : "No matching results")
              : tab === "watchlist"
                ? (isArabicWorld ? "قائمة المشاهدة فارغة" : "Your watchlist is empty")
                : tab === "not-started"
                  ? "No Anime series are waiting to be started"
                  : tab === "watching"
                    ? "No Anime series are in progress"
                    : (isArabicWorld ? "لم تتم مشاهدة أي شيء بعد" : "Nothing watched yet")
          }
          description={
            search
              ? (isArabicWorld ? `لم نجد أي عنصر يطابق "${search}". جرب كلمات مختلفة أو امسح البحث.` : `No title matches “${search}”. Try another search or clear it.`)
              : tab === "watchlist"
                ? (isArabicWorld ? "ابدأ بإضافة أفلام عربية من صفحة الاستكشاف." : `Add ${world === "anime" ? "Anime titles" : world === "asian-movies" ? "Asian movies" : "movies"} from Discover.`)
                : tab === "watched"
                  ? "Mark a title as watched and it will appear here."
                  : "Add Anime series from Discover and track their released episodes."
          }
          action={
            !search && (
              <Button onClick={() => onDiscover ? onDiscover() : setView("discover")} size="sm">
                {isArabicWorld ? "استكشاف المزيد" : world === "anime" ? "Discover Anime" : "Discover more"}
              </Button>
            )
          }
        />
      ) : (
        <div className={usesHomePosterGrid ? HOME_MEDIA_CARD_GRID_CLASS : layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid grid-cols-1 gap-3 md:grid-cols-2"}>
          {visibleItems.map((item, index) => (
            <CollectionMediaCard
              key={item.id}
              item={item}
              index={index}
              tab={tab}
              layout={layout}
              homePresentation={isMovieWorld || world === "anime"}
              arabicUi={isArabicWorld}
              enableSwipe={isMobileViewport && isMovieWorld}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && !isMobileViewport && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
            {isArabicWorld ? "السابق" : "Prev"}
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            {isArabicWorld ? "الصفحة" : "Page"} <span className="font-bold text-foreground">{page + 1}</span> {isArabicWorld ? "من" : "of"} {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}>
            {isArabicWorld ? "التالي" : "Next"}
          </Button>
        </div>
      )}

      {isMobileViewport && (
        <div ref={infiniteSentinelRef} className="tvtime-infinite-sentinel" aria-live="polite">
          {hasMoreMobile && media.isFetching ? (
            <span><Loader2 className="h-4 w-4 animate-spin" /> {isArabicWorld ? "تحميل المزيد…" : "Loading more…"}</span>
          ) : hasMoreMobile ? (
            <span className="text-muted-foreground">{isArabicWorld ? "مرّر لتحميل المزيد" : "Scroll for more"}</span>
          ) : visibleItems.length > 0 ? (
            <span className="text-muted-foreground">{isArabicWorld ? "وصلت للنهاية" : "You reached the end"}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RangeFilter({
  label,
  fromLabel,
  toLabel,
  min,
  max,
  step,
  suffix = "",
  value,
  presets = [],
  onChange,
}: {
  label: string;
  fromLabel: string;
  toLabel: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  value: [number, number];
  presets?: Array<{ label: string; value: [number, number] }>;
  onChange: (value: [number, number]) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const isFloat = step < 1;
  const fmt = (n: number) => (isFloat ? (Math.round(n * 10) / 10).toString() : String(Math.round(n)));
  const [fromDraft, setFromDraft] = useState(fmt(value[0]));
  const [toDraft, setToDraft] = useState(fmt(value[1]));
  const [activeThumb, setActiveThumb] = useState<0 | 1 | null>(null);

  useEffect(() => setFromDraft(fmt(value[0])), [value[0]]);
  useEffect(() => setToDraft(fmt(value[1])), [value[1]]);

  const commitFrom = () => {
    const parsed = Number(fromDraft);
    if (!Number.isFinite(parsed)) { setFromDraft(fmt(value[0])); return; }
    const next = Math.min(clamp(parsed), value[1]);
    setFromDraft(fmt(next));
    onChange([next, value[1]]);
  };
  const commitTo = () => {
    const parsed = Number(toDraft);
    if (!Number.isFinite(parsed)) { setToDraft(fmt(value[1])); return; }
    const next = Math.max(clamp(parsed), value[0]);
    setToDraft(fmt(next));
    onChange([value[0], next]);
  };
  const percentage = (n: number) => max === min ? 0 : ((n - min) / (max - min)) * 100;

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold tabular-nums">
          {fmt(value[0])}{suffix} — {fmt(value[1])}{suffix}
        </span>
      </div>
      {presets.length > 0 && (
        <div className="tvtime-range-presets mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.value)}
              className="shrink-0 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground active:scale-[0.97]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="tvtime-range-slider relative"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const rawPercent = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 100 : 0;
          const pointerPercent = window.getComputedStyle(event.currentTarget).direction === "rtl" ? 100 - rawPercent : rawPercent;
          const fromDistance = Math.abs(pointerPercent - percentage(value[0]));
          const toDistance = Math.abs(pointerPercent - percentage(value[1]));
          setActiveThumb(fromDistance <= toDistance ? 0 : 1);
        }}
        onPointerUp={() => setActiveThumb(null)}
        onPointerCancel={() => setActiveThumb(null)}
        onPointerLeave={(event) => { if (event.buttons === 0) setActiveThumb(null); }}
      >
        {activeThumb != null && (
          <span className="tvtime-range-bubble" data-active="true" style={{ insetInlineStart: `${percentage(value[activeThumb])}%` }}>
            {fmt(value[activeThumb])}{suffix}
          </span>
        )}
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={(next) => onChange([next[0] ?? value[0], next[1] ?? value[1]])}
          aria-label={label}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">{fromLabel}</span>
          <Input
            type="number"
            inputMode={isFloat ? "decimal" : "numeric"}
            min={min}
            max={value[1]}
            step={step}
            value={fromDraft}
            onChange={(event) => setFromDraft(event.target.value)}
            onBlur={commitFrom}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setFromDraft(fmt(value[0])); }}
            className="h-9 tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">{toLabel}</span>
          <Input
            type="number"
            inputMode={isFloat ? "decimal" : "numeric"}
            min={value[0]}
            max={max}
            step={step}
            value={toDraft}
            onChange={(event) => setToDraft(event.target.value)}
            onBlur={commitTo}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setToDraft(fmt(value[1])); }}
            className="h-9 tabular-nums"
          />
        </label>
      </div>
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

function CollectionMediaCard({
  item,
  index,
  tab,
  layout,
  homePresentation = false,
  arabicUi = false,
  enableSwipe = false,
}: {
  item: MediaItemDB;
  index: number;
  tab: CollectionTab;
  layout: "grid" | "list";
  homePresentation?: boolean;
  arabicUi?: boolean;
  enableSwipe?: boolean;
}) {
  const isWatchedTab = tab === "watched";
  const update = useMediaUpdate();
  const showWatchUndo = useWatchUndo();
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeXRef = useRef(0);
  const swipeTriggeredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    touchStartRef.current = null;
  };

  const publicRating = item.rating ? parseFloat(item.rating) : null;
  const userRating = item.type === "series" && item.status !== "finished"
    ? null
    : item.userRating;

  // Determine media type explicitly from the item's type field — never guess
  const isMovie = item.type === "movie";
  const isFinishedShow = item.type === "series" && item.status === "finished";
  const isCompleted = (isMovie && item.watched) || isFinishedShow;
  const useHomePresentation = homePresentation && layout === "grid";
  const displayTitle = arabicUi
    ? pickArabicTitle(item, isMovie ? "movie" : "tv", item.title)
    : item.title;

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
    if (item.userRating != null) {
      const result = await update.mutateAsync({
        id: item.id,
        userRating: item.userRating,
        watched: true,
        watchedAt: new Date().toISOString(),
        status: "watched",
      });
      showWatchUndo(`Marked as watched · Your rating ${item.userRating}/100`, result);
      return;
    }
    setRatingOpen(true);
  };

  const handleRate = async (rating: number) => {
    if (isMovie && !item.watched) {
      return update.mutateAsync({
        id: item.id,
        userRating: rating,
        watched: true,
        watchedAt: new Date().toISOString(),
        status: "watched",
      });
    }
    return update.mutateAsync({ id: item.id, userRating: rating });
  };

  const handleRemoveRating = async () => {
    const result = await update.mutateAsync(isMovie
      ? {
          id: item.id,
          userRating: null,
          watched: false,
          watchedAt: null,
          status: null,
        }
      : { id: item.id, userRating: null });
    showWatchUndo(isMovie
      ? "Rating removed and movie marked as not watched"
      : "Rating removed and Finished status cleared", result);
  };

  const handleUnwatch = async () => {
    const result = await update.mutateAsync({
      id: item.id,
      watched: false,
      watchedAt: null,
      status: null,
    });
    showWatchUndo("Removed from Watched. Rating was preserved.", result);
  };

  // Quick remove from watchlist — clears status only, doesn't touch watched/rating.
  // Used on watchlist items where the user wants to remove the movie entirely.
  const handleQuickUnwatch = async () => {
    const result = await update.mutateAsync({
      id: item.id,
      status: null,
    });
    showWatchUndo("Removed from watchlist", result);
  };

  const finishSwipe = async () => {
    const distance = swipeXRef.current;
    swipeXRef.current = 0;
    setSwipeX(0);
    clearLongPress();
    if (!enableSwipe || tab !== "watchlist" || Math.abs(distance) < 72 || update.isPending) return;
    swipeTriggeredRef.current = true;
    if (distance > 0) {
      await handleMarkWatched();
    } else {
      await handleQuickUnwatch();
    }
    window.setTimeout(() => { swipeTriggeredRef.current = false; }, 50);
  };


  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
        className={useHomePresentation ? "tvtime-media-card group relative min-w-0" : "group"}
      >
        {enableSwipe && tab === "watchlist" && (
          <div className="tvtime-swipe-actions" aria-hidden="true">
            <span data-side="right"><Check className="h-4 w-4" /> Watched</span>
            <span data-side="left">Remove</span>
          </div>
        )}
        <Card
          className={useHomePresentation ? "" : `group overflow-hidden border-border/50 bg-card p-0 transition-[border-color,box-shadow,background-color,transform] duration-200 hover:border-primary/55 hover:shadow-lg hover:shadow-primary/10 ${layout === "list" ? "grid grid-cols-[92px_1fr]" : ""}`}
          style={enableSwipe && tab === "watchlist" ? { transform: `translateX(${swipeX}px)` } : undefined}
        >
          <div
            className={useHomePresentation
              ? "tvtime-media-poster relative aspect-[2/3] cursor-pointer overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              : `relative cursor-pointer overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${layout === "list" ? "row-span-2 aspect-[2/3]" : "aspect-[2/3]"}`}
            onClick={() => {
              if (longPressTriggeredRef.current || swipeTriggeredRef.current || Math.abs(swipeXRef.current) > 8) {
                longPressTriggeredRef.current = false;
                return;
              }
              handleOpenDetails();
            }}
            onPointerDown={(event) => {
              if (event.pointerType !== "touch") return;
              longPressTriggeredRef.current = false;
              swipeTriggeredRef.current = false;
              swipeXRef.current = 0;
              setSwipeX(0);
              touchStartRef.current = { x: event.clientX, y: event.clientY };
              longPressTimerRef.current = setTimeout(() => {
                longPressTriggeredRef.current = true;
                setActionMenuOpen(true);
                if ("vibrate" in navigator) navigator.vibrate?.(12);
              }, 520);
            }}
            onPointerMove={(event) => {
              const start = touchStartRef.current;
              if (!start) return;
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              if (Math.hypot(dx, dy) > 12) {
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (enableSwipe && tab === "watchlist" && Math.abs(dx) > Math.abs(dy) + 6) {
                const next = Math.max(-104, Math.min(104, dx));
                swipeXRef.current = next;
                setSwipeX(next);
              }
            }}
            onPointerUp={() => void finishSwipe()}
            onPointerCancel={() => { swipeXRef.current = 0; setSwipeX(0); clearLongPress(); }}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`${arabicUi ? "فتح تفاصيل" : "Open details for"} ${displayTitle}${item.year ? ` (${item.year})` : ""}`}
          >
            {item.poster ? (
              <SafeImage
                src={item.poster}
                alt={displayTitle}
                loading="lazy"
                className={useHomePresentation
                  ? "tvtime-media-poster__image relative h-full w-full object-cover"
                  : "h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {item.type === "movie" ? <Film className="w-12 h-12" /> : <Tv className="w-12 h-12" />}
              </div>
            )}
            {useHomePresentation && <div className="tvtime-media-poster__veil pointer-events-none absolute inset-0" aria-hidden="true" />}
            {isCompleted && (
              <WatchedIndicator
                rating={userRating}
                status={isFinishedShow ? "finished" : "watched"}
              />
            )}
            {!isCompleted && <TmdbScoreIndicator rating={publicRating} />}
            {tab === "watchlist" && <WatchlistIndicator />}

          </div>

          <div className={useHomePresentation ? "tvtime-media-copy" : `flex min-w-0 items-center gap-2 border-t border-border/60 bg-card px-3 py-2.5 ${layout === "list" ? "" : "min-h-[4.5rem]"}`}>
            <div className="min-w-0 flex-1">
              <h3 className={useHomePresentation ? "tvtime-media-title line-clamp-2 text-start" : "line-clamp-1 text-sm font-semibold leading-tight text-foreground"} title={displayTitle}>{displayTitle}</h3>
              <div className={useHomePresentation ? "tvtime-media-meta" : "mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"}>
                {item.year && <span>{item.year}</span>}
                {item.year && <span aria-hidden="true">•</span>}
                <span className="inline-flex min-w-0 items-center gap-1">
                  {isMovie ? <Film aria-hidden="true" /> : <Tv aria-hidden="true" />}
                  <span className="truncate">{item.isAnime ? "Anime" : item.isArabic ? (arabicUi ? (isMovie ? "فيلم عربي" : "مسلسل عربي") : (isMovie ? "Arabic Movie" : "Arabic TV")) : isMovie ? "Movie" : "TV"}</span>
                </span>
              </div>
            </div>
            <DropdownMenu open={actionMenuOpen} onOpenChange={setActionMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className={useHomePresentation ? "tvtime-media-menu absolute z-20 h-8 w-8 p-0" : "h-8 w-8 shrink-0 p-0"}
                  aria-label={`${arabicUi ? "إجراءات إضافية لـ" : "More actions for"} ${displayTitle}`}
                  title={arabicUi ? "إجراءات إضافية" : "More actions"}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{displayTitle}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleOpenDetails}>
                  <Play /> {arabicUi ? "فتح التفاصيل" : "Open details"}
                </DropdownMenuItem>
                {!isWatchedTab && (
                  <DropdownMenuItem onSelect={() => void handleMarkWatched()} disabled={update.isPending}>
                    <Check /> {item.type === "series" ? "Open episode tracking" : "Mark as watched"}
                  </DropdownMenuItem>
                )}
                {isWatchedTab && item.type === "movie" && (
                  <DropdownMenuItem onSelect={() => setRatingOpen(true)}>
                    <Star /> {userRating != null ? "Change rating" : "Rate"}
                  </DropdownMenuItem>
                )}
                {isWatchedTab && userRating != null && (
                  <DropdownMenuItem onSelect={() => void handleRemoveRating()} disabled={update.isPending}>
                    {isMovie ? "Remove rating & watched" : "Remove rating & Finished"}
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

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      </motion.div>

      <RatingDialog
        open={ratingOpen}
        onOpenChange={setRatingOpen}
        title={displayTitle}
        poster={item.poster}
        onRate={handleRate}
        initialRating={item.userRating ?? null}
        description={isMovie && !item.watched
          ? "Choose your rating out of 100 to mark this movie watched. Closing or cancelling keeps it unwatched."
          : "Update your personal rating out of 100."}
        submitLabel={isMovie && !item.watched ? "Save rating & mark watched" : "Save rating"}
        successMessage={isMovie && !item.watched
          ? (rating) => `Marked as watched · Your rating ${rating}/100`
          : (rating) => `Rated ${rating}/100`}
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
