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
  Star, TrendingUp, Calendar, Search,
} from "lucide-react";

const MOVIE_SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "popularity.asc", label: "Least popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "vote_average.asc", label: "Lowest rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
];

const TV_SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "popularity.asc", label: "Least popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "vote_average.asc", label: "Lowest rated" },
  { value: "first_air_date.desc", label: "Newest" },
  { value: "first_air_date.asc", label: "Oldest" },
];

const CURRENT_YEAR = new Date().getFullYear();
const RELEASE_YEARS = Array.from({ length: 80 }, (_, index) => CURRENT_YEAR - index);
const LETTERS = ["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

export function ArabicDiscoverCatalog({ kind }: { kind: "movie" | "tv" }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [userScoreRange, setUserScoreRange] = useState<[number, number]>([0, 10]);
  const [letter, setLetter] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [keywords, setKeywords] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const PAGES_TO_FETCH = letter ? 5 : 1;

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = kind === "movie" ? movieGenres.data : tvGenres.data;
  const releaseDateFrom = fromYear ? `${fromYear}-01-01` : undefined;
  const releaseDateTo = toYear ? `${toYear}-12-31` : undefined;
  const minRating = userScoreRange[0] > 0 ? userScoreRange[0] : undefined;

  const commonParams = {
    genres: selectedGenres,
    rating: minRating,
    sort_by: sortBy,
    originalLanguage: "ar",
    voteCount: 0,
    releaseDateFrom,
    releaseDateTo,
  };

  // Always 5 hooks unconditionally
  const movieQ1 = useDiscoverMovies({ ...commonParams, page, enabled: kind === "movie" && PAGES_TO_FETCH >= 1 });
  const movieQ2 = useDiscoverMovies({ ...commonParams, page: page + 1, enabled: kind === "movie" && PAGES_TO_FETCH >= 2 });
  const movieQ3 = useDiscoverMovies({ ...commonParams, page: page + 2, enabled: kind === "movie" && PAGES_TO_FETCH >= 3 });
  const movieQ4 = useDiscoverMovies({ ...commonParams, page: page + 3, enabled: kind === "movie" && PAGES_TO_FETCH >= 4 });
  const movieQ5 = useDiscoverMovies({ ...commonParams, page: page + 4, enabled: kind === "movie" && PAGES_TO_FETCH >= 5 });

  const tvQ1 = useDiscoverTv({ ...commonParams, page, enabled: kind === "tv" && PAGES_TO_FETCH >= 1 });
  const tvQ2 = useDiscoverTv({ ...commonParams, page: page + 1, enabled: kind === "tv" && PAGES_TO_FETCH >= 2 });
  const tvQ3 = useDiscoverTv({ ...commonParams, page: page + 2, enabled: kind === "tv" && PAGES_TO_FETCH >= 3 });
  const tvQ4 = useDiscoverTv({ ...commonParams, page: page + 3, enabled: kind === "tv" && PAGES_TO_FETCH >= 4 });
  const tvQ5 = useDiscoverTv({ ...commonParams, page: page + 4, enabled: kind === "tv" && PAGES_TO_FETCH >= 5 });

  const movieQueries = [movieQ1, movieQ2, movieQ3, movieQ4, movieQ5].slice(0, PAGES_TO_FETCH);
  const tvQueries = [tvQ1, tvQ2, tvQ3, tvQ4, tvQ5].slice(0, PAGES_TO_FETCH);
  const queries = kind === "movie" ? movieQueries : tvQueries;

  const allResults = useMemo(() => {
    const combined: any[] = [];
    queries.forEach((q: any) => {
      if (q.data?.results) combined.push(...q.data.results);
    });
    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PAGES_TO_FETCH, kind, page, sortBy, minRating, releaseDateFrom, releaseDateTo]);

  const totalAvailable = queries[0]?.data?.total_results ?? 0;
  const totalPages = Math.min(queries[0]?.data?.total_pages ?? 1, 500);

  const items = useMemo(() => {
    let filtered = allResults.filter((item) => item.poster_path && item.original_language === "ar");
    if (letter) {
      const titleKey = kind === "movie" ? "title" : "name";
      if (letter === "#") {
        filtered = filtered.filter((m) => {
          const t = (m as any)[titleKey] || "";
          return t && !/^[a-zA-Z\u0600-\u06FF]/.test(t[0]);
        });
      } else {
        filtered = filtered.filter((m) => {
          const t = ((m as any)[titleKey] || "").toUpperCase();
          return t.startsWith(letter);
        });
      }
    }
    if (userScoreRange[1] < 10) {
      filtered = filtered.filter((m) => (m.vote_average || 0) <= userScoreRange[1]);
    }
    if (keywords.trim()) {
      const kw = keywords.trim().toLowerCase();
      filtered = filtered.filter((m) => {
        const t = ((m.title || m.name) || "").toLowerCase();
        const o = (m.overview || "").toLowerCase();
        return t.includes(kw) || o.includes(kw);
      });
    }
    return filtered;
  }, [allResults, letter, kind, userScoreRange, keywords]);

  const isLoading = queries.some((q: any) => q.isLoading);
  const isError = queries.some((q: any) => q.isError);
  const isFetching = queries.some((q: any) => q.isFetching);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((current) =>
      current.includes(genreId) ? current.filter((id) => id !== genreId) : [...current, genreId]
    );
    setPage(1);
  };

  const resetFilters = () => {
    setSelectedGenres([]);
    setFromYear(""); setToYear("");
    setUserScoreRange([0, 10]);
    setLetter("");
    setKeywords("");
    setSortBy("popularity.desc");
    setPage(1);
  };

  const activeFilters =
    selectedGenres.length +
    Number(fromYear !== "") + Number(toYear !== "") +
    Number(userScoreRange[0] > 0 || userScoreRange[1] < 10) +
    Number(letter !== "") +
    Number(keywords.trim() !== "");

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

      <div className="flex gap-5">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <SlidersHorizontal className="w-4 h-4 mr-1.5" />
          {sidebarOpen ? "Hide Filters" : "Show Filters"}
          {activeFilters > 0 && <Badge variant="secondary" className="ml-1.5">{activeFilters}</Badge>}
        </Button>

        <aside className={`${sidebarOpen ? "block" : "hidden"} lg:block w-full lg:w-80 shrink-0 space-y-4`}>
          <div className="glass rounded-xl p-4 space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="font-bold">Filters</span>
                {activeFilters > 0 && <Badge variant="secondary" className="text-[10px]">{activeFilters}</Badge>}
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              )}
            </div>

            <FilterSection title="Sort" icon={<TrendingUp className="w-3.5 h-3.5" />}>
              <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterSection>

            <FilterSection title="Release Date" icon={<Calendar className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fromYear || "any"} onValueChange={(v) => { setFromYear(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="From" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="any">From</SelectItem>
                    {RELEASE_YEARS.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={toYear || "any"} onValueChange={(v) => { setToYear(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="To" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="any">To</SelectItem>
                    {RELEASE_YEARS.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </FilterSection>

            <FilterSection title={`Genres${selectedGenres.length > 0 ? ` (${selectedGenres.length})` : ""}`}>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {genres?.map((genre) => {
                  const selected = selectedGenres.includes(genre.id);
                  return (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenre(genre.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        selected ? "bg-primary text-primary-foreground" : "bg-accent text-foreground/80 hover:bg-accent/70"
                      }`}
                    >
                      {genre.name}
                      {selected && <X className="ml-1 h-3 w-3 inline" />}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            <FilterSection title={`Starts With${letter ? `: ${letter}` : ""}`}>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => { setLetter(""); setPage(1); }}
                  className={`h-7 px-2 rounded text-xs font-mono ${letter === "" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"}`}
                >
                  All
                </button>
                {LETTERS.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLetter(l); setPage(1); }}
                    className={`h-7 w-7 rounded text-xs font-mono ${letter === l ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {letter && <p className="text-[10px] text-muted-foreground mt-1.5">Fetching 5 pages to compensate for letter filter</p>}
            </FilterSection>

            <FilterSection title={`User Score: ${userScoreRange[0]} - ${userScoreRange[1]}`}>
              <div className="px-1">
                <input
                  type="range" min="0" max="10" step="0.5"
                  value={userScoreRange[0]}
                  onChange={(e) => { setUserScoreRange([Number(e.target.value), userScoreRange[1]]); setPage(1); }}
                  className="w-full accent-primary"
                />
                <input
                  type="range" min="0" max="10" step="0.5"
                  value={userScoreRange[1]}
                  onChange={(e) => { setUserScoreRange([userScoreRange[0], Number(e.target.value)]); setPage(1); }}
                  className="w-full accent-primary mt-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>0</span><span>5</span><span>10</span>
                </div>
              </div>
            </FilterSection>

            <FilterSection title="Keywords">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={keywords}
                  onChange={(e) => { setKeywords(e.target.value); setPage(1); }}
                  placeholder="Filter by keywords..."
                  className="h-8 text-xs pl-7"
                />
              </div>
            </FilterSection>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : (
              <>
                Showing <span className="font-bold text-foreground">{items.length}</span>
                {letter ? " (filtered)" : ""} of <span className="font-bold text-foreground">{totalAvailable.toLocaleString()}</span> results
              </>
            )}
          </p>

          {isLoading ? (
            <MediaGrid items={[]} loading forcedMediaType={kind} />
          ) : isError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 py-16 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
              <p className="font-semibold">Could not load the Arabic catalogue</p>
              <p className="mt-1 text-sm text-muted-foreground">TMDB may be temporarily unavailable. Your library data was not affected.</p>
              <Button variant="outline" className="mt-4" onClick={() => queries[0]?.refetch()}>Retry</Button>
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
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Page <strong className="text-foreground">{page}</strong> of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((value) => value + 1)}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}
