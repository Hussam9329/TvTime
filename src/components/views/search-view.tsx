"use client";

import { useNav } from "@/lib/store";
import { useSearch } from "@/hooks/use-tmdb";
import { MediaGrid } from "@/components/media/media-card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SearchView() {
  const { searchQuery, setSearchQuery } = useNav();
  const [local, setLocal] = useState(searchQuery);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");

  const search = useSearch(searchQuery);

  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== searchQuery) setSearchQuery(local);
    }, 350);
    return () => clearTimeout(t);
  }, [local, searchQuery, setSearchQuery]);

  const allResults = (search.data?.results ?? []).filter((r) => r.media_type !== "person" && (r.poster_path || r.backdrop_path));
  const filtered = filter === "all" ? allResults : allResults.filter((r) => r.media_type === filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Search</h1>
        <p className="text-sm text-muted-foreground">Find movies and TV shows from the TMDB database</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Type a title..."
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
          <p>Start typing to search across millions of titles</p>
        </div>
      )}

      {searchQuery && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {search.isLoading ? "Searching..." : `${search.data?.total_results ?? 0} results for "${searchQuery}"`}
            </p>
            {allResults.length > 0 && (
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="movie">Movies</TabsTrigger>
                  <TabsTrigger value="tv">TV</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          {search.isLoading ? (
            <MediaGrid items={[]} loading />
          ) : filtered.length > 0 ? (
            <MediaGrid items={filtered} />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>No results found. Try a different search.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
