"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useFilteredDiscover, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterField, FilterGrid, FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X } from "lucide-react";
import {
  ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, AlertCircle,
  Compass, Star, TrendingUp, Calendar, Clock, Search, Type,
  Sparkles, Info,
} from "lucide-react";
import { toast } from "sonner";
import { arabicMediaCountryPriority, isArabicMediaItem } from "@/lib/arabic-media";
import { isAnimeMediaItem } from "@/lib/anime-detect";
import { ASIAN_ORIGIN_COUNTRY_QUERY, asianMediaCountryPriority, isAsianMediaItem } from "@/lib/asian-media";
import { standardMediaCountryPriority } from "@/lib/standard-media-priority";
import { applyDiscoverPreset, type DiscoverPresetId } from "@/lib/discover-presets";
import { updateDiscoverRange } from "@/lib/discover-filter-state";

export type DiscoverWorld = "movies" | "tv" | "anime" | "arabic-movies" | "arabic-tv" | "asian-tv";
type TvFormatFilter = "all" | "miniseries" | "anthology";

// Sort options
const SORT_OPTIONS_MOVIES = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "popularity.asc", label: "Least Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "vote_average.asc", label: "Lowest Rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
  { value: "revenue.desc", label: "Highest Revenue" },
  { value: "title.asc", label: "Alphabetical A-Z" },
  { value: "title.desc", label: "Alphabetical Z-A" },
];

const SORT_OPTIONS_TV = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "popularity.asc", label: "Least Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "vote_average.asc", label: "Lowest Rated" },
  { value: "first_air_date.desc", label: "Newest" },
  { value: "first_air_date.asc", label: "Oldest" },
  { value: "name.asc", label: "Alphabetical A-Z" },
  { value: "name.desc", label: "Alphabetical Z-A" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i);

const RUNTIME_OPTIONS_MOVIES = {
  min: [30, 60, 90, 120, 150, 180],
  max: [60, 90, 120, 150, 180, 240],
};
const RUNTIME_OPTIONS_TV = {
  min: [15, 30, 45, 60, 90, 120],
  max: [15, 30, 45, 60, 90, 120, 180],
};

const CERTIFICATIONS_MOVIES = ["G", "PG", "PG-13", "R", "NC-17"];

const LANGUAGES = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "hi", label: "Hindi" },
  { code: "zh", label: "Chinese" },
  { code: "tr", label: "Turkish" },
  { code: "fa", label: "Persian" },
];

const BASE_PRESETS = [
  { id: "trending", label: "Popular" },
  { id: "top2024", label: `Top ${CURRENT_YEAR}` },
  { id: "hidden", label: "Hidden gems" },
  { id: "newest", label: "Newest" },
  { id: "classic", label: "Classics" },
] satisfies Array<{ id: DiscoverPresetId; label: string }>;

interface DiscoverViewProps {
  world?: DiscoverWorld;
  embedded?: boolean;
  title?: string;
  subtitle?: string;
  mediaType?: "movie" | "tv";
}

export function DiscoverView({ world = "movies", embedded = false, title, subtitle, mediaType }: DiscoverViewProps) {
  const isTV = world === "tv" || world === "arabic-tv" || world === "asian-tv" || (world === "anime" && mediaType !== "movie");
  const isAnime = world === "anime";
  const isArabic = world === "arabic-movies" || world === "arabic-tv";
  const isAsian = world === "asian-tv";
  const forcedLang = isAnime ? "ja" : isArabic ? "ar" : undefined;
  const forcedLanguageLabel = forcedLang === "ar" ? "Arabic" : forcedLang === "ja" ? "Japanese" : null;
  const tmdbLanguage = isArabic ? "ar" as const : isAnime ? "ja" as const : undefined;

  const discoverTab = useNav((s) => s.discoverTab);
  const setDiscoverTab = useNav((s) => s.setDiscoverTab);
  const effectiveIsTV = embedded ? isTV : discoverTab === "tv";
  const supportsTvFormat = effectiveIsTV && !isAnime && !isArabic && !isAsian;

  const presets = useMemo(() => supportsTvFormat
    ? [
        ...BASE_PRESETS.slice(0, 3),
        { id: "miniseries" as const, label: "Mini Series" },
        { id: "anthology" as const, label: "Anthology" },
        ...BASE_PRESETS.slice(3),
      ]
    : BASE_PRESETS,
  [supportsTvFormat]);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [userScoreMin, setUserScoreMin] = useState("");
  const [userScoreMax, setUserScoreMax] = useState("");
  const [minVotes, setMinVotes] = useState("");
  const [runtimeMin, setRuntimeMin] = useState("");
  const [runtimeMax, setRuntimeMax] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [certification, setCertification] = useState("");
  const [language, setLanguage] = useState(forcedLang || "");
  const [keywords, setKeywords] = useState("");
  const [debouncedKeywords, setDebouncedKeywords] = useState("");
  const [tvFormat, setTvFormat] = useState<TvFormatFilter>("all");
  const [showMe, setShowMe] = useState<"all" | "unseen" | "seen">("all");
  const [filteredCursors, setFilteredCursors] = useState<(string | null)[]>([null]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedKeywords(keywords.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [keywords]);

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = effectiveIsTV ? tvGenres.data : movieGenres.data;
  const selectedGenreLabel = selectedGenres.length === 0
    ? "All genres"
    : selectedGenres.length === 1
      ? genres?.find((genre) => genre.id === selectedGenres[0])?.name || "1 genre selected"
      : `${selectedGenres.length} genres selected`;

  // Build TMDB discover params
  const yearFrom = fromYear ? Number(fromYear) : undefined;
  const yearTo = toYear ? Number(toYear) : undefined;
  const releaseDateFrom = yearFrom ? `${yearFrom}-01-01` : undefined;
  const releaseDateTo = yearTo ? `${yearTo}-12-31` : undefined;
  const minRating = userScoreMin ? Number(userScoreMin) : undefined;
  const maxRating = userScoreMax ? Number(userScoreMax) : undefined;
  const voteCount = minVotes ? Number(minVotes) : undefined;
  const runtimeFrom = runtimeMin ? Number(runtimeMin) : undefined;
  const runtimeTo = runtimeMax ? Number(runtimeMax) : undefined;
  const keywordsParam = debouncedKeywords || undefined;

  // Apply a vote threshold only when the user explicitly selects one.
  const effectiveVoteCount = voteCount;

  const certificationParam = !effectiveIsTV ? (certification || undefined) : undefined;

  const effectiveGenres = isAnime
    ? [...new Set([16, ...selectedGenres])]
    : selectedGenres;

  const commonParams = {
    genres: effectiveGenres.length > 0 ? effectiveGenres : undefined,
    sort_by: sortBy,
    rating: minRating,
    originalLanguage: language || undefined,
    originCountries: isAsian ? ASIAN_ORIGIN_COUNTRY_QUERY : undefined,
    voteCount: effectiveVoteCount,
    releaseDateFrom,
    releaseDateTo,
    runtimeGte: runtimeFrom,
    runtimeLte: runtimeTo,
    keywordQuery: keywordsParam,
    language: tmdbLanguage,
  };

  const resultMediaType: "movie" | "tv" = effectiveIsTV ? "tv" : "movie";
  const resultWorld = isAnime ? "anime" : isArabic ? "arabic" : isAsian ? "asian" : "standard";
  const seenLabel = effectiveIsTV ? "Started" : "Seen";
  const unseenLabel = effectiveIsTV ? "Not started" : "Haven't seen";
  const movieQuery = useDiscoverMovies({
    ...commonParams,
    maxRating,
    certification: certificationParam,
    page,
    enabled: !effectiveIsTV && showMe === "all",
  });
  const filteredQuery = useFilteredDiscover({
    ...commonParams,
    mediaType: resultMediaType,
    showMe: effectiveIsTV && showMe === "all" ? "all" : showMe === "seen" ? "seen" : "unseen",
    world: resultWorld,
    tvFormat: supportsTvFormat && tvFormat !== "all" ? tvFormat : undefined,
    cursor: filteredCursors[page - 1] ?? null,
    maxRating,
    certification: certificationParam,
    excludeArabic: !isArabic,
    onlyArabic: isArabic,
    enabled: effectiveIsTV || showMe !== "all",
  });

  const usesCursorPagination = effectiveIsTV || showMe !== "all";
  const query = usesCursorPagination ? filteredQuery : movieQuery;
  const allResults = query.data?.results ?? [];
  const totalAvailable = movieQuery.data?.total_results ?? 0;
  const totalPages = Math.min(movieQuery.data?.total_pages ?? 1, 500);
  const isLoading = query.isLoading;
  const isError = query.isError;

  const items = useMemo(() => {
    let filtered = allResults.filter((media) => isArabic || !isArabicMediaItem(media));
    if (effectiveIsTV && !isAnime && !isArabic) {
      filtered = filtered.filter((media) => !isAnimeMediaItem(media));
    }
    if (effectiveIsTV && world === "tv") {
      filtered = filtered.filter((media) => !isAsianMediaItem(media));
      if (sortBy === "popularity.desc") {
        filtered.sort((left, right) => standardMediaCountryPriority(left) - standardMediaCountryPriority(right));
      }
    }
    if (world === "movies") {
      filtered.sort((left, right) => standardMediaCountryPriority(left) - standardMediaCountryPriority(right));
    }
    if (isAsian) {
      filtered = filtered.filter((media) => isAsianMediaItem(media) && !isAnimeMediaItem(media) && !isArabicMediaItem(media));
      filtered.sort((left, right) => asianMediaCountryPriority(left) - asianMediaCountryPriority(right));
    }
    if (forcedLang === "ar") {
      filtered = filtered.filter(isArabicMediaItem);
    }
    if (forcedLang === "ja" && isAnime) {
      filtered = filtered.filter((m) => m.original_language === "ja");
    }
    if (world === "arabic-movies" || world === "arabic-tv") {
      filtered.sort((left, right) => arabicMediaCountryPriority(left) - arabicMediaCountryPriority(right));
    }
    return filtered;
  }, [allResults, effectiveIsTV, forcedLang, isAnime, isArabic, isAsian, sortBy, world]);

  const resetPagination = useCallback(() => {
    setPage(1);
    setFilteredCursors([null]);
  }, []);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]));
    resetPagination();
  };

  const updateYears = (boundary: "min" | "max", value: string) => {
    const next = updateDiscoverRange({ min: fromYear, max: toYear }, boundary, value);
    setFromYear(next.min);
    setToYear(next.max);
    resetPagination();
  };

  const updateScores = (boundary: "min" | "max", value: string) => {
    const next = updateDiscoverRange({ min: userScoreMin, max: userScoreMax }, boundary, value);
    setUserScoreMin(next.min);
    setUserScoreMax(next.max);
    resetPagination();
  };

  const updateRuntimes = (boundary: "min" | "max", value: string) => {
    const next = updateDiscoverRange({ min: runtimeMin, max: runtimeMax }, boundary, value);
    setRuntimeMin(next.min);
    setRuntimeMax(next.max);
    resetPagination();
  };

  const resetAll = () => {
    setSelectedGenres([]);
    setFromYear(""); setToYear("");
    setUserScoreMin(""); setUserScoreMax("");
    setMinVotes("");
    setRuntimeMin(""); setRuntimeMax("");
    setCertification("");
    setLanguage(forcedLang || "");
    setKeywords("");
    setDebouncedKeywords("");
    setTvFormat("all");
    setShowMe("all");
    setSortBy("popularity.desc");
    resetPagination();
  };

  const applyPreset = (presetId: string) => {
    if (presetId === "miniseries" || presetId === "anthology") {
      const nextFormat = tvFormat === presetId ? "all" : presetId;
      setTvFormat(nextFormat);
      resetPagination();
      toast.success(nextFormat === "all" ? "TV format filter cleared" : `Showing ${presetId === "miniseries" ? "Mini Series" : "Anthology"}`);
      return;
    }

    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    const next = applyDiscoverPreset(
      { sortBy, fromYear, toYear, minVotes },
      preset.id as DiscoverPresetId,
      { isTv: effectiveIsTV, isArabic, currentYear: CURRENT_YEAR },
    );
    setSortBy(next.sortBy);
    setFromYear(next.fromYear);
    setToYear(next.toYear);
    setMinVotes(next.minVotes);
    resetPagination();
    toast.success(`Applied preset: ${preset.label}`);
  };

  const activeFilters =
    selectedGenres.length +
    Number(sortBy !== "popularity.desc") +
    Number(fromYear !== "") + Number(toYear !== "") +
    Number(userScoreMin !== "") + Number(userScoreMax !== "") +
    Number(minVotes !== "") +
    Number(runtimeMin !== "") + Number(runtimeMax !== "") +
    Number(certification !== "") +
    Number(language !== "" && language !== forcedLang) +
    Number(keywords.trim() !== "") +
    Number(tvFormat !== "all") +
    Number(showMe !== "all");

  // Build active-filter chips for the trail below the filter panel header
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    selectedGenres.forEach((genreId) => {
      const genreName = genres?.find((genre) => genre.id === genreId)?.name || `Genre ${genreId}`;
      chips.push({
        label: genreName,
        clear: () => {
          setSelectedGenres((current) => current.filter((id) => id !== genreId));
          resetPagination();
        },
      });
    });
    if (sortBy !== "popularity.desc") {
      const sortLabel = (effectiveIsTV ? SORT_OPTIONS_TV : SORT_OPTIONS_MOVIES)
        .find((option) => option.value === sortBy)?.label || sortBy;
      chips.push({ label: `Sort: ${sortLabel}`, clear: () => { setSortBy("popularity.desc"); resetPagination(); } });
    }
    if (fromYear) chips.push({ label: `From ${fromYear}`, clear: () => { setFromYear(""); resetPagination(); } });
    if (toYear) chips.push({ label: `To ${toYear}`, clear: () => { setToYear(""); resetPagination(); } });
    if (certification) chips.push({ label: `Rating: ${certification}`, clear: () => { setCertification(""); resetPagination(); } });
    if (language && language !== forcedLang) {
      const langLabel = LANGUAGES.find((l) => l.code === language)?.label || language;
      chips.push({ label: `Lang: ${langLabel}`, clear: () => { setLanguage(forcedLang || ""); resetPagination(); } });
    }
    if (userScoreMin) chips.push({ label: `≥ ${userScoreMin}★`, clear: () => { setUserScoreMin(""); resetPagination(); } });
    if (userScoreMax) chips.push({ label: `≤ ${userScoreMax}★`, clear: () => { setUserScoreMax(""); resetPagination(); } });
    if (minVotes) chips.push({ label: `${minVotes}+ votes`, clear: () => { setMinVotes(""); resetPagination(); } });
    if (runtimeMin) chips.push({ label: `≥ ${runtimeMin}min`, clear: () => { setRuntimeMin(""); resetPagination(); } });
    if (runtimeMax) chips.push({ label: `≤ ${runtimeMax}min`, clear: () => { setRuntimeMax(""); resetPagination(); } });
    if (keywords.trim()) chips.push({ label: `“${keywords.trim().slice(0, 20)}”`, clear: () => { setKeywords(""); resetPagination(); } });
    if (tvFormat !== "all") {
      chips.push({
        label: tvFormat === "miniseries" ? "Mini Series" : "Anthology",
        clear: () => { setTvFormat("all"); resetPagination(); },
      });
    }
    if (showMe !== "all") {
      chips.push({
        label: showMe === "seen" ? seenLabel : unseenLabel,
        clear: () => { setShowMe("all"); resetPagination(); },
      });
    }
    return chips;
  }, [selectedGenres, genres, sortBy, effectiveIsTV, fromYear, toYear, certification, language, forcedLang, userScoreMin, userScoreMax, minVotes, runtimeMin, runtimeMax, keywords, tvFormat, showMe, seenLabel, unseenLabel, resetPagination]);

  const advancedFilterCount =
    Number(userScoreMin !== "") +
    Number(userScoreMax !== "") +
    Number(minVotes !== "") +
    Number(runtimeMin !== "") +
    Number(runtimeMax !== "") +
    Number(Boolean(language && !forcedLang && !effectiveIsTV)) +
    Number(keywords.trim() !== "");

  const headerTitle = title || (embedded
    ? `Discover ${world === "anime" ? "Anime" : world === "arabic-movies" ? "Arabic Movies" : world === "arabic-tv" ? "Arabic TV Shows" : world === "asian-tv" ? "Asian TV Shows" : effectiveIsTV ? "TV Shows" : "Movies"}`
    : "Discover");
  const headerSubtitle = subtitle || (embedded
    ? `Find new ${world === "anime" ? "anime" : world === "arabic-movies" || world === "arabic-tv" ? "Arabic" : world === "asian-tv" ? "Asian shows" : effectiveIsTV ? "shows" : "movies"} to add to your library`
    : `Find your next favorite ${effectiveIsTV ? "show" : "movie"}`);

  const sortOptions = effectiveIsTV ? SORT_OPTIONS_TV : SORT_OPTIONS_MOVIES;

  return (
    <div className="tvtime-discover-view space-y-5">
      {/* Header */}
      {!embedded ? (
        <div className="view-page-header flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary" aria-hidden="true">
              <Compass className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="tvtime-eyebrow">Curated catalogue</p>
              <h1 className="view-page-title text-2xl font-extrabold tracking-tight sm:text-3xl">{headerTitle}</h1>
              <p className="view-page-description mt-1 text-sm text-muted-foreground">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={discoverTab} onValueChange={(v) => { setDiscoverTab(v as any); resetAll(); }}>
              <TabsList>
                <TabsTrigger value="movies">Movies</TabsTrigger>
                <TabsTrigger value="tv">TV Shows</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      ) : (
        <div data-ui-surface="panel" className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
          <div className="view-page-header flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">{headerTitle}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{headerSubtitle}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Presets */}
      <div className="tvtime-discover-presets no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        <span className="mr-1 shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick picks</span>
        {presets.map((p) => (
          <Button
            key={p.id}
            variant={(p.id === "miniseries" || p.id === "anthology") && tvFormat === p.id ? "secondary" : "outline"}
            size="sm"
            className="h-9 shrink-0 text-xs hover:border-primary/40 hover:bg-primary/5"
            onClick={() => applyPreset(p.id)}
            aria-pressed={(p.id === "miniseries" || p.id === "anthology") ? tvFormat === p.id : undefined}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {p.label}
          </Button>
        ))}
      </div>

      {/* Filters panel */}
      <FilterPanel
        title="Filters"
        description="Choose what to show first, then narrow the catalogue with the core and advanced controls."
        activeCount={activeFilters}
        onReset={resetAll}
        collapsibleOnMobile
      >
        {/* Active filter chips trail */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/15 bg-primary/[0.035] p-2.5">
            {activeFilterChips.map((chip, i) => (
              <Badge key={i} variant="default" className="gap-1 py-0.5 pl-2 pr-1 text-[11px]">
                {chip.label}
                <button
                  onClick={chip.clear}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/20"
                  aria-label={`Clear ${chip.label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <FilterSection title="Viewing status">
          <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">Limit results using your personal viewing history.</span>
            <ToggleGroup
              type="single"
              value={showMe}
              onValueChange={(v) => { if (v) { setShowMe(v as any); resetPagination(); } }}
              className="w-full justify-start rounded-md border border-border/60 bg-background/50 sm:w-auto"
              size="sm"
            >
              <ToggleGroupItem value="all" className="h-8 flex-1 px-3 text-xs sm:flex-none">Everything</ToggleGroupItem>
              <ToggleGroupItem value="unseen" className="h-8 flex-1 px-3 text-xs sm:flex-none">{unseenLabel}</ToggleGroupItem>
              <ToggleGroupItem value="seen" className="h-8 flex-1 px-3 text-xs sm:flex-none">{seenLabel}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </FilterSection>

        <FilterSection title="Core filters" divided>
          <FilterGrid className="lg:grid-cols-3 xl:grid-cols-5">
            <FilterField label="Genres">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-between text-sm">
                    <span className="truncate">{selectedGenreLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-[260px] overflow-y-auto">
                  <DropdownMenuLabel>Genres</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={selectedGenres.length === 0}
                    onCheckedChange={() => {
                      setSelectedGenres([]);
                      resetPagination();
                    }}
                    onSelect={(event) => event.preventDefault()}
                  >
                    All genres
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {genres?.map((genre) => (
                    <DropdownMenuCheckboxItem
                      key={genre.id}
                      checked={selectedGenres.includes(genre.id)}
                      onCheckedChange={() => toggleGenre(genre.id)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {genre.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </FilterField>

            <FilterField label="Sort by">
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); resetPagination(); }}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label.includes("Alphabetical") && <Type className="mr-1 inline h-3 w-3" />}
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="From year">
              <Select value={fromYear || "any"} onValueChange={(v) => updateYears("min", v === "any" ? "" : v)}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="From year" />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  <SelectItem value="any">Any from year</SelectItem>
                  {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="To year">
              <Select value={toYear || "any"} onValueChange={(v) => updateYears("max", v === "any" ? "" : v)}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="To year" />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  <SelectItem value="any">Any to year</SelectItem>
                  {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label={effectiveIsTV ? "Language" : "Certification"}>
              {effectiveIsTV ? (
                <Select
                  value={forcedLang || language || "any"}
                  disabled={Boolean(forcedLang)}
                  onValueChange={(v) => { setLanguage(v === "any" ? "" : v); resetPagination(); }}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {forcedLang && forcedLanguageLabel ? (
                      <SelectItem value={forcedLang}>{forcedLanguageLabel} (fixed for this section)</SelectItem>
                    ) : (
                      LANGUAGES.map((l) => <SelectItem key={l.code || "any"} value={l.code || "any"}>{l.label}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={certification || "any"} onValueChange={(v) => { setCertification(v === "any" ? "" : v); resetPagination(); }}>
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue placeholder="Certification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any certification</SelectItem>
                    {CERTIFICATIONS_MOVIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </FilterField>
          </FilterGrid>
        </FilterSection>

        <FilterSection divided>
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/15">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-full justify-between rounded-none px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {advancedOpen ? "Hide advanced filters" : "Show advanced filters"}
                    {advancedFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
                        {advancedFilterCount}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 border-t border-border/50 p-3 sm:p-4">
                <FilterSection title="Ratings and reach">
                  <FilterGrid className={effectiveIsTV ? "lg:grid-cols-3" : "lg:grid-cols-4"}>
                    {!effectiveIsTV && (
                      <FilterField label="Language">
                        <Select
                          value={forcedLang || language || "any"}
                          disabled={Boolean(forcedLang)}
                          onValueChange={(v) => { setLanguage(v === "any" ? "" : v); resetPagination(); }}
                        >
                          <SelectTrigger className="h-9 w-full text-sm">
                            <SelectValue placeholder="Language" />
                          </SelectTrigger>
                          <SelectContent>
                            {forcedLang && forcedLanguageLabel ? (
                              <SelectItem value={forcedLang}>{forcedLanguageLabel} (fixed for this section)</SelectItem>
                            ) : (
                              LANGUAGES.map((l) => <SelectItem key={l.code || "any"} value={l.code || "any"}>{l.label}</SelectItem>)
                            )}
                          </SelectContent>
                        </Select>
                      </FilterField>
                    )}

                    <FilterField label="Minimum TMDB score">
                      <Select value={userScoreMin || "any"} onValueChange={(v) => updateScores("min", v === "any" ? "" : v)}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <Star className="mr-1.5 h-3.5 w-3.5" />
                          <SelectValue placeholder="Min user score" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any min score</SelectItem>
                          {[5, 6, 7, 8, 9].map((r) => <SelectItem key={r} value={String(r)}>{r}+ / 10</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FilterField>

                    <FilterField label="Maximum TMDB score">
                      <Select value={userScoreMax || "any"} onValueChange={(v) => updateScores("max", v === "any" ? "" : v)}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <Star className="mr-1.5 h-3.5 w-3.5" />
                          <SelectValue placeholder="Max user score" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any max score</SelectItem>
                          {[5, 6, 7, 8, 9, 10].map((r) => <SelectItem key={r} value={String(r)}>≤ {r} / 10</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FilterField>

                    <FilterField label="Minimum votes">
                      <Select value={minVotes || "any"} onValueChange={(v) => { setMinVotes(v === "any" ? "" : v); resetPagination(); }}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <SelectValue placeholder="Min votes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any votes</SelectItem>
                          {[
                            { v: "50", l: "50+ votes" },
                            { v: "100", l: "100+ votes" },
                            { v: "200", l: "200+ votes" },
                            { v: "500", l: "500+ votes" },
                            { v: "1000", l: "1000+ votes" },
                          ].map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  </FilterGrid>
                </FilterSection>

                <FilterSection title="Runtime and keywords" divided>
                  <FilterGrid className="lg:grid-cols-3">
                    <FilterField label="Minimum runtime">
                      <Select value={runtimeMin || "any"} onValueChange={(v) => updateRuntimes("min", v === "any" ? "" : v)}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <Clock className="mr-1.5 h-3.5 w-3.5" />
                          <SelectValue placeholder="Min runtime" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any min runtime</SelectItem>
                          {(effectiveIsTV ? RUNTIME_OPTIONS_TV.min : RUNTIME_OPTIONS_MOVIES.min)
                            .map((r) => <SelectItem key={r} value={String(r)}>{r}+ min</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FilterField>

                    <FilterField label="Maximum runtime">
                      <Select value={runtimeMax || "any"} onValueChange={(v) => updateRuntimes("max", v === "any" ? "" : v)}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <Clock className="mr-1.5 h-3.5 w-3.5" />
                          <SelectValue placeholder="Max runtime" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any max runtime</SelectItem>
                          {(effectiveIsTV ? RUNTIME_OPTIONS_TV.max : RUNTIME_OPTIONS_MOVIES.max)
                            .map((r) => <SelectItem key={r} value={String(r)}>≤ {r} min</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FilterField>

                    <FilterField label="Keywords">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={keywords}
                          onChange={(e) => { setKeywords(e.target.value); resetPagination(); }}
                          placeholder="Filter by keywords..."
                          className="h-9 pl-8 text-sm"
                        />
                      </div>
                    </FilterField>
                  </FilterGrid>

                  {(runtimeMin || runtimeMax) && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-tight text-amber-500/80">
                      <Info className="h-3 w-3" />
                      <span>{effectiveIsTV ? "Runtime uses TMDB's typical episode duration." : "Runtime is approximate because TMDB may store multiple cuts of the same film."}</span>
                    </div>
                  )}
                </FilterSection>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </FilterSection>
      </FilterPanel>

      {/* Result count — clearer wording */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isLoading ? "Loading results…" : (
            !usesCursorPagination ? (
              <>
                Showing <span className="font-bold text-foreground tabular-nums">{items.length}</span>
                {" "}of <span className="font-bold text-foreground tabular-nums">{totalAvailable.toLocaleString()}</span> titles
              </>
            ) : showMe === "all" ? (
              <>
                Showing <span className="font-bold text-foreground tabular-nums">{items.length}</span> titles on this page
              </>
            ) : (
              <>
                <span className="font-bold text-foreground tabular-nums">{items.length}</span>
                {showMe === "seen" ? ` ${seenLabel.toLowerCase()}` : ` ${unseenLabel.toLowerCase()}`} titles on this page
              </>
            )
          )}
        </p>
        {!isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {activeFilters > 0 && <Badge variant="secondary">{activeFilters} active filters</Badge>}
            <span className="tabular-nums">Page {page}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {isError && (
        <div className="feedback-state feedback-state--error flex flex-col items-center justify-center px-4 py-14 text-center" role="alert">
          <div className="feedback-state__icon mb-4 flex size-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-9 w-9" aria-hidden="true" />
          </div>
          <h2 className="feedback-state__title text-lg font-bold">We couldn&apos;t load these results</h2>
          <p className="feedback-state__description mt-1 max-w-md text-sm text-muted-foreground">
            {showMe === "all" ? "TMDB did not respond. Check your connection and try again." : "Your filtered catalogue could not be loaded. Try again without changing your filters."}
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && <MediaGrid items={[]} loading />}

      {/* Empty */}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={<SlidersHorizontal className="h-9 w-9" />}
          title={showMe === "all" ? "No titles match these filters" : `No ${showMe === "seen" ? seenLabel.toLowerCase() : unseenLabel.toLowerCase()} titles match`}
          description="Broaden the year range, remove a genre, or reset the filters to discover more titles."
          action={activeFilters > 0 ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={resetAll}>
              Reset all filters
            </Button>
          ) : undefined}
        />
      )}

      {/* Grid */}
      {!isLoading && !isError && items.length > 0 && (
        <MediaGrid items={items} forcedMediaType={resultMediaType} enableNativeLinks />
      )}

      {/* Pagination */}
      {!isLoading && !isError && (
        (!usesCursorPagination && totalPages > 1)
        || (usesCursorPagination && (page > 1 || filteredQuery.data?.has_more))
      ) && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page}</span>
            {!usesCursorPagination && ` of ${totalPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching || (usesCursorPagination ? !filteredQuery.data?.has_more : page >= totalPages)}
            onClick={() => {
              if (!usesCursorPagination) {
                setPage((current) => current + 1);
                return;
              }

              const nextCursor = filteredQuery.data?.next_cursor;
              if (!nextCursor) return;
              setFilteredCursors((current) => {
                const next = current.slice(0, page);
                next[page] = nextCursor;
                return next;
              });
              setPage((current) => current + 1);
            }}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
