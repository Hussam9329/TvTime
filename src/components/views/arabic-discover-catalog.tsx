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
import { AlertCircle, ChevronLeft, ChevronRight, Languages, RotateCcw, SlidersHorizontal, X } from "lucide-react";

const MOVIE_SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
];

const TV_SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "first_air_date.desc", label: "Newest" },
  { value: "first_air_date.asc", label: "Oldest" },
];

const CURRENT_YEAR = new Date().getFullYear();
const RELEASE_YEARS = Array.from({ length: 57 }, (_, index) => CURRENT_YEAR - index);

export function ArabicDiscoverCatalog({ kind }: { kind: "movie" | "tv" }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [releaseYear, setReleaseYear] = useState<string>("any");
  const [minimumRating, setMinimumRating] = useState<string>("any");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();
  const genres = kind === "movie" ? movieGenres.data : tvGenres.data;
  const year = releaseYear === "any" ? undefined : Number(releaseYear);
  const rating = minimumRating === "any" ? undefined : Number(minimumRating);

  const movieQuery = useDiscoverMovies({
    genres: selectedGenres,
    year,
    rating,
    sort_by: sortBy,
    page,
    originalLanguage: "ar",
    voteCount: 0,
    enabled: kind === "movie",
  });
  const tvQuery = useDiscoverTv({
    genres: selectedGenres,
    year,
    rating,
    sort_by: sortBy,
    page,
    originalLanguage: "ar",
    voteCount: 0,
    enabled: kind === "tv",
  });
  const query = kind === "movie" ? movieQuery : tvQuery;
  const items = useMemo(
    () => (query.data?.results ?? []).filter((item) => item.poster_path && item.original_language === "ar"),
    [query.data?.results],
  );
  const totalPages = Math.min(query.data?.total_pages ?? 1, 500);
  const activeFilters = selectedGenres.length + Number(releaseYear !== "any") + Number(minimumRating !== "any");

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((current) => current.includes(genreId)
      ? current.filter((id) => id !== genreId)
      : [...current, genreId]);
    setPage(1);
  };

  const resetFilters = () => {
    setSelectedGenres([]);
    setReleaseYear("any");
    setMinimumRating("any");
    setSortBy("popularity.desc");
    setPage(1);
  };

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

      <div className="glass space-y-3 rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Independent Arabic filters
            {activeFilters > 0 && <Badge variant="secondary">{activeFilters} active</Badge>}
          </div>
        </div>

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

        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setPage(1); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              {(kind === "movie" ? MOVIE_SORT_OPTIONS : TV_SORT_OPTIONS).map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={releaseYear} onValueChange={(value) => { setReleaseYear(value); setPage(1); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Release year" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="any">Any release year</SelectItem>
              {RELEASE_YEARS.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={minimumRating} onValueChange={(value) => { setMinimumRating(value); setPage(1); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Minimum rating" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any rating</SelectItem>
              <SelectItem value="6">6+ / 10</SelectItem>
              <SelectItem value="7">7+ / 10</SelectItem>
              <SelectItem value="8">8+ / 10</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
