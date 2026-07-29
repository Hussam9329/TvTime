"use client";

import { useNav } from "@/lib/store";
import { useSearchAccumulated } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Search as SearchIcon, X, Loader2, AlertCircle, Users, ChevronDown, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { img } from "@/lib/tmdb";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { isAnimeMediaItem } from "@/lib/anime-detect";
import { isAsianMediaItem } from "@/lib/asian-media";

export function SearchView() {
  const { searchQuery, setSearchQuery, goPerson } = useNav();
  const [local, setLocal] = useState(searchQuery);
  const [filter, setFilter] = useState<"all" | "movie" | "tv" | "anime" | "asian-tv" | "arabic-movies" | "arabic-tv" | "people">("all");

  const search = useSearchAccumulated(searchQuery);

  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== searchQuery) setSearchQuery(local);
    }, 350);
    return () => clearTimeout(t);
  }, [local, searchQuery, setSearchQuery]);

  const allResults = search.accumulated;
  const filtered = filter === "all"
    ? allResults
    : filter === "arabic-movies"
      ? allResults.filter((result) => result.media_type === "movie" && isArabicMediaItem(result))
      : filter === "arabic-tv"
        ? allResults.filter((result) => result.media_type === "tv" && isArabicMediaItem(result))
        : filter === "anime"
          ? allResults.filter((result) => result.media_type === "tv" && isAnimeMediaItem(result))
        : filter === "asian-tv"
          ? allResults.filter((result) => result.media_type === "tv" && !isAnimeMediaItem(result) && !isArabicMediaItem(result) && isAsianMediaItem(result))
        : filter === "movie"
          ? allResults.filter((result) => result.media_type === "movie" && !isArabicMediaItem(result) && !isAnimeMediaItem(result))
          : filter === "tv"
            ? allResults.filter((result) => result.media_type === "tv" && !isArabicMediaItem(result) && !isAnimeMediaItem(result) && !isAsianMediaItem(result))
            : [];
  const arabicMovieCount = allResults.filter((result) => result.media_type === "movie" && isArabicMediaItem(result)).length;
  const arabicTvCount = allResults.filter((result) => result.media_type === "tv" && isArabicMediaItem(result)).length;
  const animeCount = allResults.filter((result) => result.media_type === "tv" && isAnimeMediaItem(result)).length;
  const asianTvCount = allResults.filter((result) => result.media_type === "tv" && !isAnimeMediaItem(result) && !isArabicMediaItem(result) && isAsianMediaItem(result)).length;
  const people = search.people;
  const filterLabel = {
    all: "all results",
    movie: "movies",
    tv: "TV shows",
    anime: "anime",
    "asian-tv": "Asian TV",
    "arabic-movies": "Arabic movies",
    "arabic-tv": "Arabic TV",
    people: "people",
  }[filter];

  return (
    <div className="tvtime-search-view space-y-5">
      <div className="view-page-header flex items-start gap-3">
        <SearchIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="tvtime-eyebrow">Universal search</p>
          <h1 className="view-page-title mb-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Search</h1>
          <p className="view-page-description text-sm text-muted-foreground">Find movies, TV shows, anime, Arabic titles and people from the TMDB database.</p>
        </div>
      </div>

      <div className="relative max-w-4xl">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Type a title or person's name..."
          className="h-12 rounded-xl pl-10 pr-10 text-base"
          autoFocus
        />
        {local && (
          <button
            onClick={() => { setLocal(""); setSearchQuery(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!searchQuery && (
        <EmptyState
          icon={<SearchIcon className="h-9 w-9" />}
          title="What do you want to watch?"
          description="Search by title or person, then narrow the results by media world."
        />
      )}

      {searchQuery && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {search.isLoading
                ? "Searching..."
                : `${search.totalResults} results for "${searchQuery}"`}
            </p>
            {(allResults.length > 0 || people.length > 0) && (
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="max-w-full">
                <TabsList className="h-auto max-w-[calc(100vw-1.5rem)] justify-start overflow-x-auto sm:max-w-none">
                  <TabsTrigger value="all">All ({allResults.length})</TabsTrigger>
                  <TabsTrigger value="movie">Movies</TabsTrigger>
                  <TabsTrigger value="tv">TV</TabsTrigger>
                  {animeCount > 0 && <TabsTrigger value="anime">Anime ({animeCount})</TabsTrigger>}
                  {asianTvCount > 0 && <TabsTrigger value="asian-tv">Asian TV ({asianTvCount})</TabsTrigger>}
                  {arabicMovieCount > 0 && (
                    <TabsTrigger value="arabic-movies" className="gap-1.5">
                      <Languages className="h-3.5 w-3.5" /> Arabic Movies ({arabicMovieCount})
                    </TabsTrigger>
                  )}
                  {arabicTvCount > 0 && (
                    <TabsTrigger value="arabic-tv" className="gap-1.5">
                      <Languages className="h-3.5 w-3.5" /> Arabic TV ({arabicTvCount})
                    </TabsTrigger>
                  )}
                  {people.length > 0 && (
                    <TabsTrigger value="people">People ({people.length})</TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            )}
          </div>

          {/* TVM-30: Error state */}
          {search.isError && (
            <div className="feedback-state feedback-state--error flex flex-col items-center justify-center px-4 py-14 text-center" role="alert">
              <div className="feedback-state__icon mb-4 flex size-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertCircle className="h-9 w-9" aria-hidden="true" />
              </div>
              <h2 className="feedback-state__title text-lg font-bold">Search is temporarily unavailable</h2>
              <p className="feedback-state__description mt-1 max-w-md text-sm text-muted-foreground">TMDB did not respond. Your library is safe; check your connection and try again.</p>
              <Button variant="outline" className="mt-4" onClick={() => setSearchQuery(searchQuery)}>
                Retry
              </Button>
            </div>
          )}

          {/* TVM-30: Loading state (initial) */}
          {search.isLoading && <MediaGrid items={[]} loading />}

          {/* People results (TVM-32) */}
          {filter === "people" && people.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {people.map((p, i) => (
                <PersonCard key={`person-${p.id}`} person={p} index={i} onGo={() => goPerson(p.id)} />
              ))}
            </div>
          )}

          {/* Media results */}
          {filter !== "people" && (
            <>
              {filtered.length > 0 ? (
                <MediaGrid items={filtered} />
              ) : !search.isLoading && !search.isError ? (
                <EmptyState
                  icon={<SearchIcon className="h-9 w-9" />}
                  title="No matching results"
                  description={`We couldn't find “${searchQuery}” in ${filterLabel}. Try a shorter title, a different spelling, or another filter.`}
                />
              ) : null}
            </>
          )}

          {/* TVM-31: Load More pagination */}
          {filter !== "people" && search.hasMore && filtered.length > 0 && (
            <div className="flex items-center justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={search.loadMore}
                disabled={search.isFetching}
                className="min-w-[160px]"
              >
                {search.isFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...
                  </>
                ) : (
                  <>
                    Load More <ChevronDown className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* People Load More */}
          {filter === "people" && search.hasMore && people.length > 0 && (
            <div className="flex items-center justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={search.loadMore}
                disabled={search.isFetching}
                className="min-w-[160px]"
              >
                {search.isFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...
                  </>
                ) : (
                  <>
                    Load More <ChevronDown className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}

          {!search.hasMore && !search.isLoading && (filtered.length > 0 || people.length > 0) && (
            <p className="text-center text-xs text-muted-foreground pt-2">— End of results —</p>
          )}
        </>
      )}
    </div>
  );
}

// TVM-32: Person card for search results
function PersonCard({ person, index, onGo }: { person: any; index: number; onGo: () => void }) {
  const name = person.name || person.original_name || "Unknown";
  const knownFor = (person.known_for ?? []).slice(0, 2).map((k: any) => k.title || k.name || "").filter(Boolean).join(", ");

  return (
    <button
      onClick={onGo}
      className="group text-left"
      style={{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }}
    >
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 group-hover:border-primary/60 transition-colors">
        {person.profile_path ? (
          <img
            src={img(person.profile_path, "w342")}
            alt={name}
            className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Users className="w-10 h-10 opacity-40" />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">{name}</p>
      {knownFor && <p className="text-[10px] text-muted-foreground line-clamp-1">{knownFor}</p>}
    </button>
  );
}
