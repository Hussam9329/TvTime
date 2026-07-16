"use client";

import { useState, useMemo } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, SlidersHorizontal, Dices, AlertCircle,
  Compass, Star, TrendingUp, Calendar, Search, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { isArabicMediaItem } from "@/lib/arabic-media";

export type DiscoverWorld = "movies" | "tv" | "anime" | "arabic-movies" | "arabic-tv";

const SORT_OPTIONS_MOVIES = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "popularity.asc", label: "Least Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "vote_average.asc", label: "Lowest Rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
  { value: "revenue.desc", label: "Highest Revenue" },
];

const SORT_OPTIONS_TV = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "popularity.asc", label: "Least Popular" },
  { value: "vote_average.desc", label: "Highest Rated" },
  { value: "vote_average.asc", label: "Lowest Rated" },
  { value: "first_air_date.desc", label: "Newest" },
  { value: "first_air_date.asc", label: "Oldest" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i);
const LETTERS = ["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

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
  const [userScoreRange, setUserScoreRange] = useState<[number, number]>([0, 10]);
  const [minVotes, setMinVotes] = useState(0);
  const [runtimeRange, setRuntimeRange] = useState<[number, number]>([0, 400]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [certification, setCertification] = useState("");
  const [language, setLanguage] = useState(forcedLang || "");
  const [keywords, setKeywords] = useState("");
  const [letter, setLetter] = useState("");
  const [showMe, setShowMe] = useState<"all" | "unseen" | "seen">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // When letter filter is active, fetch 5 pages to compensate client-side filtering
  const PAGES_TO_FETCH = letter ? 5 : 1;

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = effectiveIsTV ? tvGenres.data : movieGenres.data;

  const yearFrom = fromYear ? Number(fromYear) : undefined;
  const yearTo = toYear ? Number(toYear) : undefined;
  const releaseDateFrom = yearFrom ? `${yearFrom}-01-01` : undefined;
  const releaseDateTo = yearTo ? `${yearTo}-12-31` : undefined;
  const minRating = userScoreRange[0] > 0 ? userScoreRange[0] : undefined;
  const maxRating = userScoreRange[1] < 10 ? userScoreRange[1] : undefined;
  const voteCount = minVotes > 0 ? minVotes : undefined;
  const runtimeFrom = runtimeRange[0] > 0 ? runtimeRange[0] : undefined;
  const runtimeTo = runtimeRange[1] < 400 ? runtimeRange[1] : undefined;
  const keywordsParam = keywords.trim() || undefined;

  // Common params for all queries
  const commonParams = {
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    rating: minRating,
    originalLanguage: language || undefined,
    voteCount,
    releaseDateFrom,
    releaseDateTo,
  };

  // Always call 5 movie hooks + 5 TV hooks (to comply with React rules-of-hooks)
  const movieQ1 = useDiscoverMovies({ ...commonParams, page, enabled: !effectiveIsTV && PAGES_TO_FETCH >= 1 });
  const movieQ2 = useDiscoverMovies({ ...commonParams, page: page + 1, enabled: !effectiveIsTV && PAGES_TO_FETCH >= 2 });
  const movieQ3 = useDiscoverMovies({ ...commonParams, page: page + 2, enabled: !effectiveIsTV && PAGES_TO_FETCH >= 3 });
  const movieQ4 = useDiscoverMovies({ ...commonParams, page: page + 3, enabled: !effectiveIsTV && PAGES_TO_FETCH >= 4 });
  const movieQ5 = useDiscoverMovies({ ...commonParams, page: page + 4, enabled: !effectiveIsTV && PAGES_TO_FETCH >= 5 });

  const tvQ1 = useDiscoverTv({ ...commonParams, page, enabled: effectiveIsTV && PAGES_TO_FETCH >= 1 });
  const tvQ2 = useDiscoverTv({ ...commonParams, page: page + 1, enabled: effectiveIsTV && PAGES_TO_FETCH >= 2 });
  const tvQ3 = useDiscoverTv({ ...commonParams, page: page + 2, enabled: effectiveIsTV && PAGES_TO_FETCH >= 3 });
  const tvQ4 = useDiscoverTv({ ...commonParams, page: page + 3, enabled: effectiveIsTV && PAGES_TO_FETCH >= 4 });
  const tvQ5 = useDiscoverTv({ ...commonParams, page: page + 4, enabled: effectiveIsTV && PAGES_TO_FETCH >= 5 });

  const movieQueries = [movieQ1, movieQ2, movieQ3, movieQ4, movieQ5].slice(0, PAGES_TO_FETCH);
  const tvQueries = [tvQ1, tvQ2, tvQ3, tvQ4, tvQ5].slice(0, PAGES_TO_FETCH);
  const queries = effectiveIsTV ? tvQueries : movieQueries;

  const allResults = useMemo(() => {
    const combined: any[] = [];
    queries.forEach((q: any) => {
      if (q.data?.results) combined.push(...q.data.results);
    });
    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PAGES_TO_FETCH, effectiveIsTV, page, sortBy, minRating, language, voteCount, releaseDateFrom, releaseDateTo]);

  const totalAvailable = queries[0]?.data?.total_results ?? 0;
  const totalPages = Math.min(queries[0]?.data?.total_pages ?? 1, 500);

  const items = useMemo(() => {
    let filtered = allResults.filter((media) => media.poster_path && !isArabicMediaItem(media));
    if (forcedLang === "ar") {
      filtered = filtered.filter((m) => m.original_language === "ar");
    }
    if (forcedLang === "ja" && isAnime) {
      filtered = filtered.filter((m) => m.original_language === "ja");
    }
    // Letter filter (client-side, hence multi-page fetch)
    if (letter) {
      const titleKey = effectiveIsTV ? "name" : "title";
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
    if (maxRating !== undefined) {
      filtered = filtered.filter((m) => (m.vote_average || 0) <= maxRating);
    }
    if (runtimeFrom !== undefined || runtimeTo !== undefined) {
      filtered = filtered.filter((m) => {
        const rt = m.runtime || m.episode_run_time?.[0] || 0;
        if (!rt) return true;
        if (runtimeFrom !== undefined && rt < runtimeFrom) return false;
        if (runtimeTo !== undefined && rt > runtimeTo) return false;
        return true;
      });
    }
    if (keywordsParam) {
      const kw = keywordsParam.toLowerCase();
      filtered = filtered.filter((m) => {
        const t = ((m.title || m.name) || "").toLowerCase();
        const o = (m.overview || "").toLowerCase();
        return t.includes(kw) || o.includes(kw);
      });
    }
    return filtered;
  }, [allResults, letter, effectiveIsTV, forcedLang, isAnime, maxRating, runtimeFrom, runtimeTo, keywordsParam]);

  const isLoading = queries.some((q: any) => q.isLoading);
  const isError = queries.some((q: any) => q.isError);
  const isFetching = queries.some((q: any) => q.isFetching);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]));
    setPage(1);
  };

  const resetAll = () => {
    setSelectedGenres([]);
    setFromYear(""); setToYear("");
    setUserScoreRange([0, 10]);
    setMinVotes(0);
    setRuntimeRange([0, 400]);
    setCertification("");
    setLanguage(forcedLang || "");
    setKeywords("");
    setLetter("");
    setShowMe("all");
    setSortBy("popularity.desc");
    setPage(1);
  };

  const activeFilters =
    selectedGenres.length +
    Number(fromYear !== "") + Number(toYear !== "") +
    Number(userScoreRange[0] > 0 || userScoreRange[1] < 10) +
    Number(minVotes > 0) +
    Number(runtimeRange[0] > 0 || runtimeRange[1] < 400) +
    Number(certification !== "") +
    Number(language !== "" && language !== forcedLang) +
    Number(keywords.trim() !== "") +
    Number(letter !== "") +
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

      <div className="flex gap-5">
        {/* Mobile toggle */}
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <SlidersHorizontal className="w-4 h-4 mr-1.5" />
          {sidebarOpen ? "Hide Filters" : "Show Filters"}
          {activeFilters > 0 && <Badge variant="secondary" className="ml-1.5">{activeFilters}</Badge>}
        </Button>

        {/* Filter Sidebar (TMDB-style) */}
        <aside className={`${sidebarOpen ? "block" : "hidden"} lg:block w-full lg:w-80 shrink-0 space-y-4`}>
          <div className="glass rounded-xl p-4 space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="font-bold">Filters</span>
                {activeFilters > 0 && <Badge variant="secondary" className="text-[10px]">{activeFilters}</Badge>}
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetAll}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              )}
            </div>

            {/* Sort */}
            <FilterSection title="Sort" icon={<TrendingUp className="w-3.5 h-3.5" />}>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterSection>

            {/* Show Me */}
            <FilterSection title="Show Me">
              <div className="space-y-1.5">
                {[
                  { v: "all", l: "Everything" },
                  { v: "unseen", l: `${effectiveIsTV ? "Shows" : "Movies"} I Haven't Seen` },
                  { v: "seen", l: `${effectiveIsTV ? "Shows" : "Movies"} I Have Seen` },
                ].map((opt) => (
                  <label key={opt.v} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="showme"
                      checked={showMe === opt.v}
                      onChange={() => setShowMe(opt.v as any)}
                      className="accent-primary"
                    />
                    <span>{opt.l}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* Release Date */}
            <FilterSection title="Release Date" icon={<Calendar className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fromYear || "any"} onValueChange={(v) => { setFromYear(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="From" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="any">From</SelectItem>
                    {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={toYear || "any"} onValueChange={(v) => { setToYear(v === "any" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="To" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="any">To</SelectItem>
                    {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </FilterSection>

            {/* Genres */}
            <FilterSection title={`Genres${selectedGenres.length > 0 ? ` (${selectedGenres.length})` : ""}`}>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {genres?.map((g) => {
                  const isSelected = selectedGenres.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-accent text-foreground/80 hover:bg-accent/70"
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* First Letter */}
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

            {/* Certification */}
            <FilterSection title="Certification">
              <Select value={certification || "any"} onValueChange={(v) => { setCertification(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None Selected" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">None Selected</SelectItem>
                  {certOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterSection>

            {/* Language */}
            <FilterSection title="Language">
              <Select value={language || "any"} onValueChange={(v) => { setLanguage(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None Selected" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.code || "any"} value={l.code || "any"}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterSection>

            {/* User Score */}
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

            {/* Minimum Votes */}
            <FilterSection title={`Minimum Votes: ${minVotes.toLocaleString()}`}>
              <input
                type="range" min="0" max="1000" step="50"
                value={minVotes}
                onChange={(e) => { setMinVotes(Number(e.target.value)); setPage(1); }}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0</span><span>500</span><span>1000+</span>
              </div>
            </FilterSection>

            {/* Runtime */}
            <FilterSection title={`Runtime: ${runtimeRange[0]} - ${runtimeRange[1]} min`}>
              <div className="px-1">
                <input
                  type="range" min="0" max="400" step="15"
                  value={runtimeRange[0]}
                  onChange={(e) => { setRuntimeRange([Number(e.target.value), runtimeRange[1]]); setPage(1); }}
                  className="w-full accent-primary"
                />
                <input
                  type="range" min="0" max="400" step="15"
                  value={runtimeRange[1]}
                  onChange={(e) => { setRuntimeRange([runtimeRange[0], Number(e.target.value)]); setPage(1); }}
                  className="w-full accent-primary mt-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>0</span><span>200</span><span>400</span>
                </div>
              </div>
            </FilterSection>

            {/* Keywords */}
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

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : (
              <>
                Showing <span className="font-bold text-foreground">{items.length}</span>
                {letter ? " (filtered)" : ""} of <span className="font-bold text-foreground">{totalAvailable.toLocaleString()}</span> results
              </>
            )}
          </p>

          {isError && (
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
              <p className="font-medium text-foreground text-lg">Failed to load results</p>
              <p className="text-sm text-muted-foreground mt-1">Could not reach TMDB. Please try again.</p>
            </div>
          )}

          {isLoading && <MediaGrid items={[]} loading />}

          {!isLoading && !isError && items.length === 0 && (
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

          {!isLoading && !isError && items.length > 0 && (
            <MediaGrid items={items} forcedMediaType={effectiveIsTV ? "tv" : "movie"} />
          )}

          {totalPages > 1 && items.length > 0 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                Page <span className="font-bold text-foreground">{page}</span> of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
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

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
