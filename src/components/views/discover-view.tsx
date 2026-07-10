"use client";

import { useState } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Dices, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";

const SORT_OPTIONS = [
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

const DECADE_OPTIONS = [
  { value: "", label: "Any decade" },
  { value: "2020", label: "2020s" },
  { value: "2010", label: "2010s" },
  { value: "2000", label: "2000s" },
  { value: "1990", label: "1990s" },
  { value: "1980", label: "1980s" },
  { value: "1970", label: "1970s" },
];

export function DiscoverView() {
  const discoverTab = useNav((s) => s.discoverTab);
  const setDiscoverTab = useNav((s) => s.setDiscoverTab);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [decade, setDecade] = useState<string>("");
  const [minRating, setMinRating] = useState<string>("");
  // TVM-33: Multi-genre selection
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = discoverTab === "movies" ? movieGenres.data : tvGenres.data;

  // Compute year from decade (pick middle year for primary_release_year filter)
  const year = decade ? Number(decade) + 5 : undefined;

  const discover = useDiscoverMovies({
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    page,
    year,
    rating: minRating ? Number(minRating) : undefined,
  });
  const discoverTv = useDiscoverTv({
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    sort_by: sortBy,
    page,
    year,
    rating: minRating ? Number(minRating) : undefined,
  });

  const current = discoverTab === "movies" ? discover : discoverTv;
  const items = (current.data?.results ?? []).filter((m) => m.poster_path);
  const totalPages = Math.min(current.data?.total_pages ?? 1, 500);

  // TVM-33: Toggle genre selection (multi-select)
  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((g) => g !== genreId)
        : [...prev, genreId]
    );
    setPage(1);
  };

  const clearGenres = () => {
    setSelectedGenres([]);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Discover</h1>
            <p className="text-sm text-muted-foreground mt-1">Find your next favorite {discoverTab === "movies" ? "movie" : "show"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                const randomPage = Math.floor(Math.random() * 20) + 1;
                const randomSort = ["popularity.desc", "vote_average.desc", "primary_release_date.desc", "revenue.desc"][
                  Math.floor(Math.random() * 4)
                ];
                setSortBy(randomSort);
                setPage(randomPage);
                toast.success("🎲 Surprise! Here are some random picks");
              }}
            >
              <Dices className="w-4 h-4 mr-1.5" /> Surprise Me
            </Button>
            <Tabs value={discoverTab} onValueChange={(v) => { setDiscoverTab(v as any); setPage(1); clearGenres(); }}>
              <TabsList>
                <TabsTrigger value="movies">Movies</TabsTrigger>
                <TabsTrigger value="tv">TV Shows</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* TVM-33: Multi-Genre Filters */}
        <div className="glass rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {selectedGenres.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{selectedGenres.length} genre{selectedGenres.length > 1 ? "s" : ""}</Badge>
              )}
            </div>
            {selectedGenres.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearGenres}>
                <X className="w-3 h-3 mr-1" /> Clear genres
              </Button>
            )}
          </div>

          {/* Genre chips — multi-select (TVM-33) */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={selectedGenres.length === 0 ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={clearGenres}
            >
              All
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

          {/* Selected genres summary */}
          {selectedGenres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedGenres.map((gid) => {
                const g = genres?.find((x) => x.id === gid);
                return (
                  <Badge key={gid} variant="secondary" className="text-[10px] gap-1">
                    {g?.name || `Genre ${gid}`}
                    <button onClick={() => toggleGenre(gid)} className="ml-0.5 hover:text-rose-400">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {(discoverTab === "movies" ? SORT_OPTIONS : SORT_OPTIONS_TV).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={decade} onValueChange={(v) => { setDecade(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Decade" />
              </SelectTrigger>
              <SelectContent>
                {DECADE_OPTIONS.map((d) => (
                  <SelectItem key={d.value || "any"} value={d.value || "any"}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minRating || "any"} onValueChange={(v) => { setMinRating(v === "any" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Min rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any rating</SelectItem>
                <SelectItem value="7">7+ ⭐</SelectItem>
                <SelectItem value="8">8+ ⭐</SelectItem>
                <SelectItem value="9">9+ ⭐</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* TVM-30: Error state */}
      {current.isError && (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <p className="font-medium text-foreground text-lg">Failed to load results</p>
          <p className="text-sm text-muted-foreground mt-1">Could not reach TMDB. Please try again.</p>
        </div>
      )}

      {/* TVM-30: Loading skeleton */}
      {current.isLoading && <MediaGrid items={[]} loading />}

      {/* TVM-30: Empty state */}
      {!current.isLoading && !current.isError && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No results match your filters</p>
          <p className="text-sm mt-1">Try removing some genres or changing the decade/rating.</p>
          {(selectedGenres.length > 0 || decade || minRating) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { clearGenres(); setDecade(""); setMinRating(""); setPage(1); }}
            >
              Reset all filters
            </Button>
          )}
        </div>
      )}

      {/* Results grid */}
      {!current.isLoading && !current.isError && items.length > 0 && (
        <MediaGrid items={items} />
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
