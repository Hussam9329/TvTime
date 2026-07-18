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

export function SearchView() {
  const { searchQuery, setSearchQuery, goPerson, goMovie, goTv } = useNav();
  const [local, setLocal] = useState(searchQuery);
  const [filter, setFilter] = useState<"all" | "movie" | "tv" | "arabic-movies" | "arabic-tv" | "people">("all");

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
        : filter === "movie"
          ? allResults.filter((result) => result.media_type === "movie" && !isArabicMediaItem(result))
          : filter === "tv"
            ? allResults.filter((result) => result.media_type === "tv" && !isArabicMediaItem(result))
            : [];
  const arabicMovieCount = allResults.filter((result) => result.media_type === "movie" && isArabicMediaItem(result)).length;
  const arabicTvCount = allResults.filter((result) => result.media_type === "tv" && isArabicMediaItem(result)).length;
  const people = search.people;

  return (
    <div className="space-y-5">
      <div className="view-page-header">
        <h1 className="view-page-title text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Search</h1>
        <p className="view-page-description text-sm text-muted-foreground">Find movies, TV shows, anime, Arabic titles and people from the TMDB database</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Type a title or person's name..."
          className="pl-9 pr-10 h-11 text-base"
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
        <div className="text-center py-16 text-muted-foreground">
          <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Start typing to search across millions of titles and people</p>
        </div>
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
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
              <p className="font-medium text-foreground text-lg">Search failed</p>
              <p className="text-sm text-muted-foreground mt-1">Could not reach TMDB. Please try again.</p>
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
                  icon={<SearchIcon className="w-12 h-12" />}
                  title="لا توجد نتائج"
                  description={`لم نجد نتائج لـ "${searchQuery}"${filter !== "all" ? ` في فلتر "${filter}"` : ""}. جرب كلمات مختلفة أو غيّر الفلتر.`}
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
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
