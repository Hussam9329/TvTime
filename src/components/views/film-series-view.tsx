"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { useNav } from "@/lib/store";
import { userHeaders, withUserId } from "@/lib/client-user";

type FilmSeriesItem = {
  id: string;
  name: string;
  totalParts: number;
  libraryParts: number;
  watchedParts: number;
  media: Array<{ id: string; tmdbId: number | null; title: string; year: string | null; watched: boolean; seriesPart: number | null }>;
};

export function FilmSeriesView() {
  const goMovie = useNav((state) => state.goMovie);
  const query = useQuery({
    queryKey: ["film-series"],
    queryFn: async () => {
      const url = withUserId(new URL("/api/film-series", window.location.origin));
      const response = await fetch(url, { headers: userHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load film collections");
      return response.json() as Promise<{ items: FilmSeriesItem[] }>;
    },
  });

  return (
    <div className="space-y-5 py-6">
      <PageTitlebar title="Film Collections" />
      <p className="text-sm text-muted-foreground">Movie sagas grouped in canonical TMDB collection order.</p>

      {query.isLoading && (
        <div className="grid gap-4 xl:grid-cols-2" aria-busy="true" aria-label="Loading film collections">
          {[0, 1, 2, 3].map((card) => (
            <div key={card} className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}
      {query.isError && (
        <ErrorState
          title="Couldn’t load your film collections"
          description="Your collection is safe. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      )}
      {!query.isLoading && !query.isError && (query.data?.items.length ?? 0) === 0 && (
        <EmptyState
          icon={<Layers3 className="size-8" />}
          title="No film collections yet"
          description="Movies that belong to a saga appear here automatically once they are in your collection."
        />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(query.data?.items || []).map((series) => {
          const denominator = Math.max(series.totalParts, series.libraryParts, 1);
          const percentage = Math.round((series.watchedParts / denominator) * 100);
          return (
            <Card key={series.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black">{series.name}</h2>
                  <p className="text-xs text-muted-foreground">{series.watchedParts} / {denominator} watched · {series.libraryParts} in library</p>
                </div>
                <span className="text-sm font-black text-primary">{percentage}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${percentage}%` }} /></div>
              <div className="mt-4 space-y-1.5">
                {series.media.map((movie) => (
                  <button key={movie.id} type="button" disabled={!movie.tmdbId} onClick={() => movie.tmdbId && goMovie(movie.tmdbId)} className="flex w-full items-center gap-2 min-h-10 rounded-xl px-2 py-2 text-left hover:bg-accent disabled:cursor-default">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black">{movie.seriesPart ?? "—"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{movie.title}</span>
                    <span className="text-xs text-muted-foreground">{movie.watched ? "Watched" : movie.year || ""}</span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
