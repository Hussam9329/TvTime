"use client";

import { useState } from "react";
import { useNav } from "@/lib/store";
import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Dices } from "lucide-react";
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

export function DiscoverView() {
  const discoverTab = useNav((s) => s.discoverTab);
  const setDiscoverTab = useNav((s) => s.setDiscoverTab);
  const discoverGenre = useNav((s) => s.discoverGenre);
  const setDiscoverGenre = useNav((s) => s.setDiscoverGenre);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [year, setYear] = useState<string>("");
  const [minRating, setMinRating] = useState<string>("");

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = discoverTab === "movies" ? movieGenres.data : tvGenres.data;

  const discover = useDiscoverMovies({
    genre: discoverGenre,
    sort_by: sortBy,
    page,
    year: year ? Number(year) : undefined,
    rating: minRating ? Number(minRating) : undefined,
  });
  const discoverTv = useDiscoverTv({
    genre: discoverGenre,
    sort_by: sortBy,
    page,
    year: year ? Number(year) : undefined,
    rating: minRating ? Number(minRating) : undefined,
  });

  const current = discoverTab === "movies" ? discover : discoverTv;
  const items = (current.data?.results ?? []).filter((m) => m.poster_path);
  const totalPages = Math.min(current.data?.total_pages ?? 1, 500);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

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
                // Pick a random page (1-20) to get varied results
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
            <Tabs value={discoverTab} onValueChange={(v) => { setDiscoverTab(v as any); setPage(1); }}>
              <TabsList>
                <TabsTrigger value="movies">Movies</TabsTrigger>
                <TabsTrigger value="tv">TV Shows</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </div>

          {/* Genre chips */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={discoverGenre === null ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setDiscoverGenre(null); setPage(1); }}
            >
              All
            </Button>
            {genres?.map((g) => (
              <Button
                key={g.id}
                variant={discoverGenre === g.id ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setDiscoverGenre(g.id); setPage(1); }}
              >
                {g.name}
              </Button>
            ))}
          </div>

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

            <Select value={year || "any"} onValueChange={(v) => { setYear(v === "any" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any year</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
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

      <MediaGrid items={items} loading={current.isLoading} />

      {/* Pagination */}
      {totalPages > 1 && (
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
