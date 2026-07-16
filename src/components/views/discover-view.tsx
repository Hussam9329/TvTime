"use client";

import { useState, useMemo } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Dices, AlertCircle, X, Compass, Type, Star, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { isArabicMediaItem } from "@/lib/arabic-media";

export type DiscoverWorld = "movies" | "tv" | "anime" | "arabic-movies" | "arabic-tv";

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most Popular", icon: TrendingUp },
  { value: "popularity.asc", label: "Least Popular", icon: TrendingUp },
  { value: "vote_average.desc", label: "Highest Rated", icon: Star },
  { value: "vote_average.asc", label: "Lowest Rated", icon: Star },
  { value: "primary_release_date.desc", label: "Newest", icon: Calendar },
  { value: "primary_release_date.asc", label: "Oldest", icon: Calendar },
  { value: "revenue.desc", label: "Highest Revenue", icon: TrendingUp },
];

const SORT_OPTIONS_TV = [
  { value: "popularity.desc", label: "Most Popular", icon: TrendingUp },
  { value: "popularity.asc", label: "Least Popular", icon: TrendingUp },
  { value: "vote_average.desc", label: "Highest Rated", icon: Star },
  { value: "vote_average.asc", label: "Lowest Rated", icon: Star },
  { value: "first_air_date.desc", label: "Newest", icon: Calendar },
  { value: "first_air_date.asc", label: "Oldest", icon: Calendar },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i);

// Letters A-Z + "#" for non-alpha
const LETTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  ...Array.from({ length: 26 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return { value: letter, label: letter };
  }),
  { value: "#", label: "#" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "5", label: "5+ ⭐" },
  { value: "6", label: "6+ ⭐" },
  { value: "7", label: "7+ ⭐" },
  { value: "8", label: "8+ ⭐" },
  { value: "9", label: "9+ ⭐" },
];

interface DiscoverViewProps {
  world?: DiscoverWorld;
  embedded?: boolean;
  title?: string;
  subtitle?: string;
}

export function DiscoverView({ world = "movies", embedded = false, title, subtitle }: DiscoverViewProps) {
  // Determine if it's TV or movie discovery
  const isTV = world === "tv" || world === "anime" || world === "arabic-tv";
  const isAnime = world === "anime";
  const isArabic = world === "arabic-movies" || world === "arabic-tv";
  const arabicLang = isArabic ? "ar" : undefined;

  // For anime, use TV discovery with Japanese original language
  const originalLanguage = isAnime ? "ja" : arabicLang;

  // Top-level discover view uses tabs (legacy behavior)
  const discoverTab = useNav((s) => s.discoverTab);
  const setDiscoverTab = useNav((s) => s.setDiscoverTab);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [year, setYear] = useState<string>("");
  const [minRating, setMinRating] = useState<string>("");
  const [letter, setLetter] = useState<string>("");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  // For top-level discover (no world specified), use the tab from nav store
  const effectiveIsTV = world === "movies" || world === "tv" || world === "arabic-movies" || world === "arabic-tv"
    ? isTV
    : (discoverTab === "tv");
  
  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = effectiveIsTV ? tvGenres.data : movieGenres.data;

  const yearNum = year ? Number(year) : undefined;
  const ratingNum = minRating ? Number(minRating) : undefined;

  const discover = useDiscoverMovies({
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    page,
    year: yearNum,
    rating: ratingNum,
    originalLanguage,
    enabled: !effectiveIsTV,
  });
  const discoverTv = useDiscoverTv({
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    page,
    year: yearNum,
    rating: ratingNum,
    originalLanguage,
    enabled: effectiveIsTV,
  });

  const current = effectiveIsTV ? discoverTv : discover;
  const allItems = current.data?.results ?? [];
  
  // Filter items by letter (client-side since TMDB doesn't support letter filter well)
  const items = useMemo(() => {
    let filtered = allItems.filter((media) => media.poster_path && !isArabicMediaItem(media));
    if (originalLanguage === "ar") {
      filtered = filtered.filter((m) => m.original_language === "ar");
    }
    if (originalLanguage === "ja" && isAnime) {
      // Anime filtering — Japanese original language is a good proxy
      filtered = filtered.filter((m) => m.original_language === "ja");
    }
    if (letter) {
      const title = effectiveIsTV ? "name" : "title";
      if (letter === "#") {
        filtered = filtered.filter((m) => {
          const t = (m as any)[title] || "";
          return t && !/^[a-zA-Z\u0600-\u06FF]/.test(t[0]);
        });
      } else {
        filtered = filtered.filter((m) => {
          const t = ((m as any)[title] || "").toUpperCase();
          return t.startsWith(letter);
        });
      }
    }
    return filtered;
  }, [allItems, letter, effectiveIsTV, originalLanguage, isAnime]);

  const totalPages = Math.min(current.data?.total_pages ?? 1, 500);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]
    );
    setPage(1);
  };

  const clearGenres = () => { setSelectedGenres([]); setPage(1); };

  const resetAll = () => {
    setSelectedGenres([]);
    setYear("");
    setMinRating("");
    setLetter("");
    setSortBy("popularity.desc");
    setPage(1);
  };

  const activeFilters = selectedGenres.length + Number(year !== "") + Number(minRating !== "") + Number(letter !== "");

  const headerTitle = title || (embedded
    ? `Discover ${world === "anime" ? "Anime" : world === "arabic-movies" ? "Arabic Movies" : world === "arabic-tv" ? "Arabic TV Shows" : effectiveIsTV ? "TV Shows" : "Movies"}`
    : "Discover");
  const headerSubtitle = subtitle || (embedded
    ? `Find new ${world === "anime" ? "anime" : world === "arabic-movies" || world === "arabic-tv" ? "Arabic" : effectiveIsTV ? "shows" : "movies"} to add to your library`
    : `Find your next favorite ${effectiveIsTV ? "show" : "movie"}`);

  return (
    <div className="space-y-5">
      {!embedded && (
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
            {!embedded && (
              <Tabs value={discoverTab} onValueChange={(v) => { setDiscoverTab(v as any); setPage(1); clearGenres(); }}>
                <TabsList>
                  <TabsTrigger value="movies">Movies</TabsTrigger>
                  <TabsTrigger value="tv">TV Shows</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>
      )}
      {embedded && (
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

      {/* Filters */}
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
              <X className="w-3 h-3 mr-1" /> Reset all
            </Button>
          )}
        </div>

        {/* Genre chips — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedGenres.length === 0 ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={clearGenres}
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

        {/* Sort + Year + Rating + Letter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {(effectiveIsTV ? SORT_OPTIONS_TV : SORT_OPTIONS).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year || "any"} onValueChange={(v) => { setYear(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="any">Any year</SelectItem>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={minRating || "any"} onValueChange={(v) => { setMinRating(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <Star className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Min rating" />
            </SelectTrigger>
            <SelectContent>
              {RATING_OPTIONS.map((r) => (
                <SelectItem key={r.value || "any"} value={r.value || "any"}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={letter || "any"} onValueChange={(v) => { setLetter(v === "any" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm">
              <Type className="w-3.5 h-3.5 mr-1.5 inline" />
              <SelectValue placeholder="Starts with" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {LETTER_OPTIONS.map((l) => (
                <SelectItem key={l.value || "any"} value={l.value || "any"}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Letter quick chips */}
        <div className="flex flex-wrap gap-1">
          <Button
            variant={letter === "" ? "default" : "outline"}
            size="sm"
            className="h-7 w-7 p-0 text-xs font-mono"
            onClick={() => { setLetter(""); setPage(1); }}
          >
            All
          </Button>
          {LETTER_OPTIONS.slice(1).map((l) => (
            <Button
              key={l.value}
              variant={letter === l.value ? "default" : "outline"}
              size="sm"
              className="h-7 w-7 p-0 text-xs font-mono"
              onClick={() => { setLetter(l.value); setPage(1); }}
            >
              {l.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {current.isError && (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <p className="font-medium text-foreground text-lg">Failed to load results</p>
          <p className="text-sm text-muted-foreground mt-1">Could not reach TMDB. Please try again.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {current.isLoading && <MediaGrid items={[]} loading />}

      {/* Empty state */}
      {!current.isLoading && !current.isError && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No results match your filters</p>
          <p className="text-sm mt-1">Try removing some filters or changing the year/rating/letter.</p>
          {activeFilters > 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={resetAll}>
              Reset all filters
            </Button>
          )}
        </div>
      )}

      {/* Results grid */}
      {!current.isLoading && !current.isError && items.length > 0 && (
        <MediaGrid items={items} forcedMediaType={effectiveIsTV ? "tv" : "movie"} />
      )}

      {/* Pagination */}
      {totalPages > 1 && items.length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || current.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page}</span> of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || current.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Tabs import (top-level discover view uses tabs to switch movies/tv)
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
