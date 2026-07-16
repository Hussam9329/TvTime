"use client";

import { useState, useMemo } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres, useWatchedMovies, useFollowing } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, SlidersHorizontal, Dices, AlertCircle,
  Compass, Star, TrendingUp, Calendar, Clock, Search, RotateCcw, Type,
} from "lucide-react";
import { toast } from "sonner";
import { isArabicMediaItem } from "@/lib/arabic-media";

export type DiscoverWorld = "movies" | "tv" | "anime" | "arabic-movies" | "arabic-tv";

// Sort options — including alphabetical (A-Z / Z-A)
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
const CERTIFICATIONS_TV = ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"];

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

  const discoverTab = useNav((s) => s.discoverTab);
  const setDiscoverTab = useNav((s) => s.setDiscoverTab);
  const effectiveIsTV = embedded ? isTV : discoverTab === "tv";

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [userScoreMin, setUserScoreMin] = useState<string>("");
  const [userScoreMax, setUserScoreMax] = useState<string>("");
  const [minVotes, setMinVotes] = useState<string>("");
  const [runtimeMin, setRuntimeMin] = useState<string>("");
  const [runtimeMax, setRuntimeMax] = useState<string>("");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [certification, setCertification] = useState("");
  const [language, setLanguage] = useState(forcedLang || "");
  const [keywords, setKeywords] = useState("");
  const [showMe, setShowMe] = useState<"all" | "unseen" | "seen">("all");

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

  // TMDB /discover/tv does NOT support certification/content_rating filter,
  // so we only send it for movies. The dropdown is hidden in the UI for TV.
  const certificationParam = !effectiveIsTV ? (certification || undefined) : undefined;

  const commonParams = {
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    rating: minRating,
    originalLanguage: language || undefined,
    voteCount,
    releaseDateFrom,
    releaseDateTo,
    runtimeGte: runtimeFrom,
    runtimeLte: runtimeTo,
    textQuery: keywordsParam,
  };

  // Single fetch (alphabetical sorting is handled by TMDB directly — no need for multi-page)
  const movieQuery = useDiscoverMovies({ ...commonParams, certification: certificationParam, page, enabled: !effectiveIsTV });
  const tvQuery = useDiscoverTv({ ...commonParams, page, enabled: effectiveIsTV });

  // Fetch the user's library so the "Show Me Seen / Unseen" filter can work.
  // Only enabled when the user actually picks that filter (to avoid extra requests).
  const watchedMoviesQuery = useWatchedMovies();
  const followedShowsQuery = useFollowing();
  const libraryTmdbIds = useMemo(() => {
    const ids = new Set<number>();
    if (effectiveIsTV) {
      for (const it of followedShowsQuery.data?.items ?? []) {
        if (typeof it.tmdbId === "number") ids.add(it.tmdbId);
      }
    } else {
      for (const it of watchedMoviesQuery.data?.items ?? []) {
        if (typeof it.tmdbId === "number") ids.add(it.tmdbId);
      }
    }
    return ids;
  }, [effectiveIsTV, watchedMoviesQuery.data, followedShowsQuery.data]);

  const query = effectiveIsTV ? tvQuery : movieQuery;
  const allResults = query.data?.results ?? [];
  const totalAvailable = query.data?.total_results ?? 0;
  const totalPages = Math.min(query.data?.total_pages ?? 1, 500);

  const items = useMemo(() => {
    let filtered = allResults.filter((media) => media.poster_path && !isArabicMediaItem(media));
    if (forcedLang === "ar") {
      filtered = filtered.filter((m) => m.original_language === "ar");
    }
    if (forcedLang === "ja" && isAnime) {
      filtered = filtered.filter((m) => m.original_language === "ja");
    }
    // Client-side filters for things TMDB doesn't support directly:
    //   - maxRating (vote_average.lte) — TMDB only exposes .gte on /discover
    //   - showMe (seen / unseen) — needs user's library; TMDB has no notion of this
    if (maxRating !== undefined) {
      filtered = filtered.filter((m) => (m.vote_average || 0) <= maxRating);
    }
    if (showMe === "seen") {
      filtered = filtered.filter((m) => libraryTmdbIds.has(m.id));
    } else if (showMe === "unseen") {
      filtered = filtered.filter((m) => !libraryTmdbIds.has(m.id));
    }
    return filtered;
  }, [allResults, forcedLang, isAnime, maxRating, showMe, libraryTmdbIds]);

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

  const headerTitle = title || (embedded
    ? `Discover ${world === "anime" ? "Anime" : world === "arabic-movies" ? "Arabic Movies" : world === "arabic-tv" ? "Arabic TV Shows" : effectiveIsTV ? "TV Shows" : "Movies"}`
    : "Discover");
  const headerSubtitle = subtitle || (embedded
    ? `Find new ${world === "anime" ? "anime" : world === "arabic-movies" || world === "arabic-tv" ? "Arabic" : effectiveIsTV ? "shows" : "movies"} to add to your library`
    : `Find your next favorite ${effectiveIsTV ? "show" : "movie"}`);

  const sortOptions = effectiveIsTV ? SORT_OPTIONS_TV : SORT_OPTIONS_MOVIES;
  const certOptions = effectiveIsTV ? CERTIFICATIONS_TV : CERTIFICATIONS_MOVIES;

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
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">{headerTitle}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{headerSubtitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters panel — horizontal layout, original design */}
      <div className="glass rounded-xl p-3 sm:p-4 space-y-3">
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

        {/* Show Me — radio buttons */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Show Me</span>
          {[
            { v: "all", l: "Everything" },
            { v: "unseen", l: `${effectiveIsTV ? "Shows" : "Movies"} I Haven't Seen` },
            { v: "seen", l: `${effectiveIsTV ? "Shows" : "Movies"} I Have Seen` },
          ].map((opt) => (
            <label key={opt.v} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name="showme"
                checked={showMe === opt.v}
                onChange={() => { setShowMe(opt.v as any); setPage(1); }}
                className="accent-primary"
              />
              <span>{opt.l}</span>
            </label>
          ))}
        </div>

        {/* Genre chips — multi-select */}
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

        {/* Sort + Year range + Certification + Language (row 1 of selects) */}
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
            <SelectContent className="max-h-72">
              <SelectItem value="any">Any from year</SelectItem>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={toYear || "any"} onValueChange={(v) => { setToYear(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="To year" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="any">Any to year</SelectItem>
              {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Certification — only shown for movies. TMDB /discover/tv has no
              content-rating filter, so showing it there would be misleading. */}
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
                {certOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Language + User Score + Min Votes (row 2 of selects) */}
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

        {/* Runtime range + Keywords (row 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        {query.isLoading ? "Loading..." : (
          <>
            Showing <span className="font-bold text-foreground">{items.length}</span> of <span className="font-bold text-foreground">{totalAvailable.toLocaleString()}</span> results
          </>
        )}
      </p>

      {/* Error */}
      {query.isError && (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <p className="font-medium text-foreground text-lg">Failed to load results</p>
          <p className="text-sm text-muted-foreground mt-1">Could not reach TMDB. Please try again.</p>
        </div>
      )}

      {/* Loading */}
      {query.isLoading && <MediaGrid items={[]} loading />}

      {/* Empty */}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No results match your filters</p>
          <p className="text-sm mt-1">Try removing some filters to see more results.</p>
          {activeFilters > 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={resetAll}>
              Reset all filters
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!query.isLoading && !query.isError && items.length > 0 && (
        <MediaGrid items={items} forcedMediaType={effectiveIsTV ? "tv" : "movie"} />
      )}

      {/* Pagination */}
      {totalPages > 1 && items.length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page}</span> of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
