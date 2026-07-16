"use client";

import { useMemo, useState } from "react";
import {
  useDiscoverMovies,
  useDiscoverTv,
  useMovieGenres,
  useTvGenres,
} from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, ChevronLeft, ChevronRight, Languages, RotateCcw, SlidersHorizontal, X,
  Star, TrendingUp, Calendar, Clock, Search, Type,
} from "lucide-react";

const MOVIE_SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "popularity.asc", label: "Least popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "vote_average.asc", label: "Lowest rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
  { value: "title.asc", label: "Alphabetical A-Z" },
  { value: "title.desc", label: "Alphabetical Z-A" },
];

const TV_SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "popularity.asc", label: "Least popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "vote_average.asc", label: "Lowest rated" },
  { value: "first_air_date.desc", label: "Newest" },
  { value: "first_air_date.asc", label: "Oldest" },
  { value: "name.asc", label: "Alphabetical A-Z" },
  { value: "name.desc", label: "Alphabetical Z-A" },
];

const CURRENT_YEAR = new Date().getFullYear();
const RELEASE_YEARS = Array.from({ length: 80 }, (_, index) => CURRENT_YEAR - index);

export function ArabicDiscoverCatalog({ kind }: { kind: "movie" | "tv" }) {
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
  const [keywords, setKeywords] = useState("");
  const [showMe, setShowMe] = useState<"all" | "unseen" | "seen">("all");

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = kind === "movie" ? movieGenres.data : tvGenres.data;
  const releaseDateFrom = fromYear ? `${fromYear}-01-01` : undefined;
  const releaseDateTo = toYear ? `${toYear}-12-31` : undefined;
  const minRating = userScoreMin ? Number(userScoreMin) : undefined;
  const maxRating = userScoreMax ? Number(userScoreMax) : undefined;
  const voteCount = minVotes ? Number(minVotes) : undefined;
  const runtimeFrom = runtimeMin ? Number(runtimeMin) : undefined;
  const runtimeTo = runtimeMax ? Number(runtimeMax) : undefined;

  const commonParams = {
    genres: selectedGenres,
    rating: minRating,
    sort_by: sortBy,
    originalLanguage: "ar",
    // TMDB's default vote_count.gte=100 excludes most Arabic films (they have
    // very few votes on TMDB). Default to 0 so Arabic catalog shows real results.
    voteCount: voteCount ?? 0,
    releaseDateFrom,
    releaseDateTo,
    runtimeGte: runtimeFrom,
    runtimeLte: runtimeTo,
    textQuery: keywords.trim() || undefined,
    // Pass language=ar so TMDB returns Arabic titles + Arabic posters (with
    // fallback to original-language artwork via include_image_language).
    language: "ar" as const,
  };

  const movieQuery = useDiscoverMovies({ ...commonParams, page, enabled: kind === "movie" });
  const tvQuery = useDiscoverTv({ ...commonParams, page, enabled: kind === "tv" });
  const query = kind === "movie" ? movieQuery : tvQuery;

  const allResults = query.data?.results ?? [];
  const totalAvailable = query.data?.total_results ?? 0;
  const totalPages = Math.min(query.data?.total_pages ?? 1, 500);

  const items = useMemo(() => {
    // Note: server already filters by original_language=ar + text_query + runtime,
    // so we only need client-side filtering for maxRating (TMDB only exposes .gte).
    let filtered = allResults.filter((item) => item.poster_path);
    if (maxRating !== undefined) {
      filtered = filtered.filter((m) => (m.vote_average || 0) <= maxRating);
    }
    return filtered;
  }, [allResults, maxRating]);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((current) =>
      current.includes(genreId) ? current.filter((id) => id !== genreId) : [...current, genreId]
    );
    setPage(1);
  };

  const resetFilters = () => {
    setSelectedGenres([]);
    setFromYear(""); setToYear("");
    setUserScoreMin(""); setUserScoreMax("");
    setMinVotes("");
    setRuntimeMin(""); setRuntimeMax("");
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
    Number(keywords.trim() !== "") +
    Number(showMe !== "all");

  const sortOptions = kind === "movie" ? MOVIE_SORT_OPTIONS : TV_SORT_OPTIONS;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <Languages className="h-5 w-5 text-emerald-400" />
              Discover Arabic {kind === "movie" ? "Movies" : "TV Shows"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              TMDB titles whose original language is Arabic. These results stay separate from the standard Movies, TV Shows and Anime worlds.
            </p>
          </div>
          {activeFilters > 0 && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Filters panel — horizontal layout */}
      <div className="glass space-y-3 rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Independent Arabic filters
            {activeFilters > 0 && <Badge variant="secondary">{activeFilters} active</Badge>}
          </div>
        </div>

        {/* Show Me */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Show Me</span>
          {[
            { v: "all", l: "Everything" },
            { v: "unseen", l: `${kind === "movie" ? "Movies" : "Shows"} I Haven't Seen` },
            { v: "seen", l: `${kind === "movie" ? "Movies" : "Shows"} I Have Seen` },
          ].map((opt) => (
            <label key={opt.v} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name="showme-ar"
                checked={showMe === opt.v}
                onChange={() => { setShowMe(opt.v as any); setPage(1); }}
                className="accent-primary"
              />
              <span>{opt.l}</span>
            </label>
          ))}
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
          {genres?.map((genre) => {
            const selected = selectedGenres.includes(genre.id);
            return (
              <Button
                key={genre.id}
                variant={selected ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleGenre(genre.id)}
              >
                {genre.name}
                {selected && <X className="ml-1 h-3 w-3" />}
              </Button>
            );
          })}
        </div>

        {/* Row 1: Sort + From year + To year */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setPage(1); }}>
            <SelectTrigger className="h-9">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label.includes("Alphabetical") && <Type className="w-3 h-3 mr-1 inline" />}
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fromYear || "any"} onValueChange={(v) => { setFromYear(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
              <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="From year" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="any">Any from year</SelectItem>
              {RELEASE_YEARS.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={toYear || "any"} onValueChange={(v) => { setToYear(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
              <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="To year" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="any">Any to year</SelectItem>
              {RELEASE_YEARS.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Min score + Max score + Min votes */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={userScoreMin || "any"} onValueChange={(v) => { setUserScoreMin(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
              <Star className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Min user score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any min score</SelectItem>
              {[5, 6, 7, 8, 9].map((r) => <SelectItem key={r} value={String(r)}>{r}+ / 10</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={userScoreMax || "any"} onValueChange={(v) => { setUserScoreMax(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
              <Star className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Max user score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any max score</SelectItem>
              {[5, 6, 7, 8, 9, 10].map((r) => <SelectItem key={r} value={String(r)}>≤ {r} / 10</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={minVotes || "any"} onValueChange={(v) => { setMinVotes(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
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

        {/* Row 3: Min runtime + Max runtime + Keywords */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={runtimeMin || "any"} onValueChange={(v) => { setRuntimeMin(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
              <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Min runtime" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any min runtime</SelectItem>
              {[30, 60, 90, 120, 150, 180].map((r) => <SelectItem key={r} value={String(r)}>{r}+ min</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={runtimeMax || "any"} onValueChange={(v) => { setRuntimeMax(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9">
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
              className="h-9 pl-8"
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {query.isLoading ? "Loading..." : (
          <>
            Showing <span className="font-bold text-foreground">{items.length}</span> of <span className="font-bold text-foreground">{totalAvailable.toLocaleString()}</span> results
          </>
        )}
      </p>

      {query.isLoading ? (
        <MediaGrid items={[]} loading forcedMediaType={kind} />
      ) : query.isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 py-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <p className="font-semibold">Could not load the Arabic catalogue</p>
          <p className="mt-1 text-sm text-muted-foreground">TMDB may be temporarily unavailable. Your library data was not affected.</p>
          <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-16 text-center text-muted-foreground">
          <Languages className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">No Arabic titles match these filters</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>Clear filters</Button>
        </div>
      ) : (
        <MediaGrid items={items} forcedMediaType={kind} />
      )}

      {items.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="px-3 text-sm text-muted-foreground">
            Page <strong className="text-foreground">{page}</strong> of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
