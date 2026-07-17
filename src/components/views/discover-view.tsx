"use client";

import { useState, useMemo } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useDiscoverTv, useFilteredDiscover, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X } from "lucide-react";
import {
  ChevronLeft, ChevronRight, SlidersHorizontal, Dices, AlertCircle,
  Compass, Star, TrendingUp, Calendar, Clock, Search, RotateCcw, Type,
  Sparkles, Info,
} from "lucide-react";
import { toast } from "sonner";
import { isArabicMediaItem } from "@/lib/arabic-media";

export type DiscoverWorld = "movies" | "tv" | "anime" | "arabic-movies" | "arabic-tv";

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
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i);

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

// Quick preset combos for one-click filtering
const PRESETS = [
  { id: "trending", label: "🔥 Trending", sort: "popularity.desc", year: "" },
  { id: "top2024", label: "🏆 Top 2024", sort: "vote_average.desc", year: "2024" },
  { id: "hidden", label: "💎 Hidden gems", sort: "vote_average.desc", year: "" },
  { id: "newest", label: "🆕 Newest", sort: "primary_release_date.desc", year: "" },
  { id: "classic", label: "🎭 Classic", sort: "popularity.desc", year: String(CURRENT_YEAR - 30) },
];

interface DiscoverViewProps {
  world?: DiscoverWorld;
  embedded?: boolean;
  title?: string;
  subtitle?: string;
}

export function DiscoverView({ world = "movies", embedded = false, title, subtitle }: DiscoverViewProps) {
  const isTV = world === "tv" || world === "anime" || world === "arabic-tv";
  const isAnime = world === "anime";
  const isArabic = world === "arabic-movies" || world === "arabic-tv";
  const forcedLang = isAnime ? "ja" : isArabic ? "ar" : undefined;
  const tmdbLanguage = isArabic ? "ar" as const : isAnime ? "ja" as const : undefined;

  const discoverTab = useNav((s) => s.discoverTab);
  const setDiscoverTab = useNav((s) => s.setDiscoverTab);
  const effectiveIsTV = embedded ? isTV : discoverTab === "tv";

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
  const [showMe, setShowMe] = useState<"all" | "unseen" | "seen">("all");
  const [filteredCursors, setFilteredCursors] = useState<(string | null)[]>([null]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = effectiveIsTV ? tvGenres.data : movieGenres.data;

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
  const keywordsParam = keywords.trim() || undefined;

  // For Arabic world, set voteCount=0 default (Arabic films have few TMDB votes).
  // For other worlds, leave undefined → lib default of 100.
  const effectiveVoteCount = isArabic ? (voteCount ?? 0) : voteCount;

  const certificationParam = !effectiveIsTV ? (certification || undefined) : undefined;

  const commonParams = {
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    rating: minRating,
    originalLanguage: language || undefined,
    voteCount: effectiveVoteCount,
    releaseDateFrom,
    releaseDateTo,
    runtimeGte: runtimeFrom,
    runtimeLte: runtimeTo,
    textQuery: keywordsParam,
    language: tmdbLanguage,
  };

  const resultMediaType: "movie" | "tv" = effectiveIsTV ? "tv" : "movie";
  const movieQuery = useDiscoverMovies({ ...commonParams, certification: certificationParam, page, enabled: !effectiveIsTV && showMe === "all" });
  const tvQuery = useDiscoverTv({ ...commonParams, page, enabled: effectiveIsTV && showMe === "all" });
  const catalogueQuery = effectiveIsTV ? tvQuery : movieQuery;
  const filteredQuery = useFilteredDiscover({
    ...commonParams,
    mediaType: resultMediaType,
    showMe: showMe === "seen" ? "seen" : "unseen",
    cursor: filteredCursors[page - 1] ?? null,
    maxRating,
    certification: certificationParam,
    excludeArabic: !isArabic,
    enabled: showMe !== "all",
  });

  const query = showMe === "all" ? catalogueQuery : filteredQuery;
  const allResults = query.data?.results ?? [];
  const totalAvailable = catalogueQuery.data?.total_results ?? 0;
  const totalPages = Math.min(catalogueQuery.data?.total_pages ?? 1, 500);
  const isLoading = query.isLoading;
  const isError = query.isError;

  const items = useMemo(() => {
    let filtered = allResults.filter((media) => media.poster_path && (isArabic || !isArabicMediaItem(media)));
    if (forcedLang === "ar") {
      filtered = filtered.filter((m) => m.original_language === "ar");
    }
    if (forcedLang === "ja" && isAnime) {
      filtered = filtered.filter((m) => m.original_language === "ja");
    }
    // Client-side filters for things TMDB doesn't support directly:
    if (maxRating !== undefined) {
      filtered = filtered.filter((m) => (m.vote_average || 0) <= maxRating);
    }
    return filtered;
  }, [allResults, forcedLang, isAnime, isArabic, maxRating]);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]));
    setPage(1);
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
    setShowMe("all");
    setSortBy("popularity.desc");
    setPage(1);
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSortBy(preset.sort);
    setFromYear(preset.year);
    setToYear("");
    setUserScoreMin("");
    setUserScoreMax("");
    setMinVotes(preset.id === "hidden" ? "100" : "");
    setRuntimeMin(""); setRuntimeMax("");
    setSelectedGenres([]);
    setCertification("");
    setKeywords("");
    setShowMe("all");
    setPage(1);
    toast.success(`Applied preset: ${preset.label}`);
  };

  const activeFilters =
    selectedGenres.length +
    Number(fromYear !== "") + Number(toYear !== "") +
    Number(userScoreMin !== "") + Number(userScoreMax !== "") +
    Number(minVotes !== "") +
    Number(runtimeMin !== "") + Number(runtimeMax !== "") +
    Number(certification !== "") +
    Number(language !== "" && language !== forcedLang) +
    Number(keywords.trim() !== "") +
    Number(showMe !== "all");

  // Build active-filter chips for the trail below the filter panel header
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (fromYear) chips.push({ label: `From ${fromYear}`, clear: () => { setFromYear(""); setPage(1); } });
    if (toYear) chips.push({ label: `To ${toYear}`, clear: () => { setToYear(""); setPage(1); } });
    if (certification) chips.push({ label: `Rating: ${certification}`, clear: () => { setCertification(""); setPage(1); } });
    if (language && language !== forcedLang) {
      const langLabel = LANGUAGES.find((l) => l.code === language)?.label || language;
      chips.push({ label: `Lang: ${langLabel}`, clear: () => { setLanguage(forcedLang || ""); setPage(1); } });
    }
    if (userScoreMin) chips.push({ label: `≥ ${userScoreMin}★`, clear: () => { setUserScoreMin(""); setPage(1); } });
    if (userScoreMax) chips.push({ label: `≤ ${userScoreMax}★`, clear: () => { setUserScoreMax(""); setPage(1); } });
    if (minVotes) chips.push({ label: `${minVotes}+ votes`, clear: () => { setMinVotes(""); setPage(1); } });
    if (runtimeMin) chips.push({ label: `≥ ${runtimeMin}min`, clear: () => { setRuntimeMin(""); setPage(1); } });
    if (runtimeMax) chips.push({ label: `≤ ${runtimeMax}min`, clear: () => { setRuntimeMax(""); setPage(1); } });
    if (keywords.trim()) chips.push({ label: `“${keywords.trim().slice(0, 20)}”`, clear: () => { setKeywords(""); setPage(1); } });
    if (showMe !== "all") {
      chips.push({
        label: showMe === "seen" ? "Seen" : "Haven't Seen",
        clear: () => { setShowMe("all"); setPage(1); },
      });
    }
    return chips;
  }, [fromYear, toYear, certification, language, forcedLang, userScoreMin, userScoreMax, minVotes, runtimeMin, runtimeMax, keywords, showMe]);

  const headerTitle = title || (embedded
    ? `Discover ${world === "anime" ? "Anime" : world === "arabic-movies" ? "Arabic Movies" : world === "arabic-tv" ? "Arabic TV Shows" : effectiveIsTV ? "TV Shows" : "Movies"}`
    : "Discover");
  const headerSubtitle = subtitle || (embedded
    ? `Find new ${world === "anime" ? "anime" : world === "arabic-movies" || world === "arabic-tv" ? "Arabic" : effectiveIsTV ? "shows" : "movies"} to add to your library`
    : `Find your next favorite ${effectiveIsTV ? "show" : "movie"}`);

  const sortOptions = effectiveIsTV ? SORT_OPTIONS_TV : SORT_OPTIONS_MOVIES;

  return (
    <div className="space-y-5">
      {/* Header */}
      {!embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{headerTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">{headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                const randomPage = Math.floor(Math.random() * 20) + 1;
                const randomSort = ["popularity.desc", "vote_average.desc", "primary_release_date.desc", "revenue.desc"][Math.floor(Math.random() * 4)];
                setSortBy(randomSort);
                setShowMe("all");
                setPage(randomPage);
                toast.success("🎲 Surprise! Here are some random picks");
              }}
            >
              <Dices className="w-4 h-4 mr-1.5" /> Surprise Me
            </Button>
            <Tabs value={discoverTab} onValueChange={(v) => { setDiscoverTab(v as any); setPage(1); resetAll(); }}>
              <TabsList>
                <TabsTrigger value="movies">Movies</TabsTrigger>
                <TabsTrigger value="tv">TV Shows</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">{headerTitle}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{headerSubtitle}</p>
              </div>
            </div>
            {/* Lift Surprise Me into embedded view too (was missing before) */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                const randomPage = Math.floor(Math.random() * 20) + 1;
                const randomSort = ["popularity.desc", "vote_average.desc", "primary_release_date.desc", "revenue.desc"][Math.floor(Math.random() * 4)];
                setSortBy(randomSort);
                setShowMe("all");
                setPage(randomPage);
                toast.success("🎲 Surprise! Here are some random picks");
              }}
            >
              <Dices className="w-4 h-4 mr-1.5" /> Surprise Me
            </Button>
          </div>
        </div>
      )}

      {/* Quick Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Quick:</span>
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            size="sm"
            className="h-7 text-xs hover:border-primary/40 hover:bg-primary/5"
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Filters panel */}
      <div className="glass rounded-xl p-3 sm:p-4 space-y-3">
        {/* Filter header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {activeFilters > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1">{activeFilters} active</Badge>
            )}
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetAll}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset all
            </Button>
          )}
        </div>

        {/* Active filter chips trail */}
        {activeFilterChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pb-1">
            {activeFilterChips.map((chip, i) => (
              <Badge key={i} variant="default" className="text-[11px] py-0.5 pl-2 pr-1 gap-1">
                {chip.label}
                <button
                  onClick={chip.clear}
                  className="ml-0.5 hover:bg-foreground/20 rounded-full p-0.5"
                  aria-label={`Clear ${chip.label}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Show Me — segmented ToggleGroup */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Show Me</span>
          <ToggleGroup
            type="single"
            value={showMe}
            onValueChange={(v) => { if (v) { setShowMe(v as any); setPage(1); } }}
            className="rounded-md border border-border/60"
            size="sm"
          >
            <ToggleGroupItem value="all" className="h-7 text-xs px-3">Everything</ToggleGroupItem>
            <ToggleGroupItem value="unseen" className="h-7 text-xs px-3">Haven&apos;t Seen</ToggleGroupItem>
            <ToggleGroupItem value="seen" className="h-7 text-xs px-3">Seen</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Genre chips */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedGenres.length === 0 ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setSelectedGenres([]); setPage(1); }}
          >
            All genres
          </Button>
          {genres?.map((g) => {
            const isSelected = selectedGenres.includes(g.id);
            return (
              <Button
                key={g.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`h-7 text-xs ${isSelected ? "ring-2 ring-primary/40" : ""}`}
                onClick={() => toggleGenre(g.id)}
              >
                {g.name}
              </Button>
            );
          })}
        </div>

        {/* Primary row: Sort + Year range + Certification/Language */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label.includes("Alphabetical") && <Type className="w-3 h-3 mr-1 inline" />}
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fromYear || "any"} onValueChange={(v) => { setFromYear(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="From year" />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              <SelectItem value="any">Any from year</SelectItem>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={toYear || "any"} onValueChange={(v) => { setToYear(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="To year" />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              <SelectItem value="any">Any to year</SelectItem>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Certification — only for movies. TV hides it and shows Language instead. */}
          {effectiveIsTV ? (
            <Select value={language || "any"} onValueChange={(v) => { setLanguage(v === "any" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.code || "any"} value={l.code || "any"}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Select value={certification || "any"} onValueChange={(v) => { setCertification(v === "any" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Certification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any certification</SelectItem>
                {CERTIFICATIONS_MOVIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Advanced filters (collapsible) */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
              <Sparkles className="w-3 h-3 mr-1" />
              {advancedOpen ? "Hide advanced filters" : "Show advanced filters"}
              {(userScoreMin || userScoreMax || minVotes || runtimeMin || runtimeMax || (language && !forcedLang && effectiveIsTV) || keywords) && (
                <Badge variant="secondary" className="text-[10px] ml-1.5">
                  {(userScoreMin ? 1 : 0) + (userScoreMax ? 1 : 0) + (minVotes ? 1 : 0) + (runtimeMin ? 1 : 0) + (runtimeMax ? 1 : 0) + ((language && !forcedLang && effectiveIsTV) ? 1 : 0) + (keywords ? 1 : 0)}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-2">
            {/* Language (movies only — TV shows it in primary row) + Score range + Votes */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${effectiveIsTV ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-2`}>
              {!effectiveIsTV && (
                <Select value={language || "any"} onValueChange={(v) => { setLanguage(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => <SelectItem key={l.code || "any"} value={l.code || "any"}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <Select value={userScoreMin || "any"} onValueChange={(v) => { setUserScoreMin(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm">
                  <Star className="w-3.5 h-3.5 mr-1.5 inline" />
                  <SelectValue placeholder="Min user score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any min score</SelectItem>
                  {[5, 6, 7, 8, 9].map((r) => <SelectItem key={r} value={String(r)}>{r}+ / 10</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={userScoreMax || "any"} onValueChange={(v) => { setUserScoreMax(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm">
                  <Star className="w-3.5 h-3.5 mr-1.5 inline" />
                  <SelectValue placeholder="Max user score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any max score</SelectItem>
                  {[5, 6, 7, 8, 9, 10].map((r) => <SelectItem key={r} value={String(r)}>≤ {r} / 10</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={minVotes || "any"} onValueChange={(v) => { setMinVotes(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm">
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
            </div>

            {/* Runtime range (with tooltip disclaimer) + Keywords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Select value={runtimeMin || "any"} onValueChange={(v) => { setRuntimeMin(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
                    <SelectValue placeholder="Min runtime" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any min runtime</SelectItem>
                    {[30, 60, 90, 120, 150, 180].map((r) => <SelectItem key={r} value={String(r)}>{r}+ min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Select value={runtimeMax || "any"} onValueChange={(v) => { setRuntimeMax(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm">
                  <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
                  <SelectValue placeholder="Max runtime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any max runtime</SelectItem>
                  {[60, 90, 120, 150, 180, 240].map((r) => <SelectItem key={r} value={String(r)}>≤ {r} min</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={keywords}
                  onChange={(e) => { setKeywords(e.target.value); setPage(1); }}
                  placeholder="Filter by keywords..."
                  className="h-9 text-sm pl-8"
                />
              </div>
            </div>

            {/* Runtime disclaimer — shown only when a runtime filter is active */}
            {(runtimeMin || runtimeMax) && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-500/80 leading-tight">
                <Info className="w-3 h-3" />
                <span>Runtime filter is approximate (TMDB may store multiple cuts of the same film).</span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Result count — clearer wording */}
      <p className="text-sm text-muted-foreground">
        {isLoading ? "Loading..." : (
          showMe === "all" ? (
            <>
              Showing <span className="font-bold text-foreground">{items.length}</span>
              {" "}of <span className="font-bold text-foreground">{totalAvailable.toLocaleString()}</span> total results
            </>
          ) : (
            <>
              Showing <span className="font-bold text-foreground">{items.length}</span>
              {showMe === "seen" ? " seen" : " not seen"} titles
            </>
          )
        )}
      </p>

      {/* Error */}
      {isError && (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <p className="font-medium text-foreground text-lg">Failed to load results</p>
          <p className="text-sm text-muted-foreground mt-1">{showMe === "all" ? "Could not reach TMDB. Please try again." : "Could not load the filtered catalogue. Please try again."}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && <MediaGrid items={[]} loading />}

      {/* Empty */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{showMe === "all" ? "No results match your filters" : `No ${showMe === "seen" ? "seen" : "not seen"} titles match your filters`}</p>
          <p className="text-sm mt-1">Try removing some filters to see more results.</p>
          {activeFilters > 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={resetAll}>
              Reset all filters
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && items.length > 0 && (
        <MediaGrid items={items} forcedMediaType={resultMediaType} />
      )}

      {/* Pagination */}
      {!isLoading && !isError && (
        (showMe === "all" && totalPages > 1)
        || (showMe !== "all" && (page > 1 || filteredQuery.data?.has_more))
      ) && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page}</span>
            {showMe === "all" && ` of ${totalPages}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching || (showMe === "all" ? page >= totalPages : !filteredQuery.data?.has_more)}
            onClick={() => {
              if (showMe === "all") {
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
