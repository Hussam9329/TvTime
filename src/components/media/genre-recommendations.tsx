"use client";

import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres } from "@/hooks/use-tmdb";
import { MediaRow } from "@/components/media/media-row";
import { Sparkles } from "lucide-react";

/**
 * Genre-based recommendations: rotates through genres daily to show
 * varied top-rated and popular content for discovery.
 */
export function GenreRecommendations() {
  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();

  // Pick genres to recommend from - rotate based on day to vary content
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const movieGenreList = movieGenres.data ?? [];
  const tvGenreList = tvGenres.data ?? [];

  const movieGenreIdx1 = dayOfYear % Math.max(movieGenreList.length, 1);
  const movieGenreIdx2 = (dayOfYear + 3) % Math.max(movieGenreList.length, 1);
  const tvGenreIdx1 = (dayOfYear + 1) % Math.max(tvGenreList.length, 1);

  const movieGenre1 = movieGenreList[movieGenreIdx1];
  const movieGenre2 = movieGenreList[movieGenreIdx2];
  const tvGenre1 = tvGenreList[tvGenreIdx1];

  const rec1 = useDiscoverMovies({ genre: movieGenre1?.id, sort_by: "vote_average.desc", page: 1, rating: 7 });
  const rec2 = useDiscoverMovies({ genre: movieGenre2?.id, sort_by: "popularity.desc", page: 1 });
  const rec3 = useDiscoverTv({ genre: tvGenre1?.id, sort_by: "popularity.desc", page: 1 });

  // Always show genre recommendations (useful for discovery).
  // When user has a watchlist, we label it "Picked for you", otherwise just genre names.

  return (
    <>
      {movieGenre1 && (rec1.data?.results?.length ?? 0) > 0 && (
        <MediaRow
          title={`Top ${movieGenre1.name} Movies`}
          icon={<Sparkles className="w-5 h-5" />}
          items={(rec1.data?.results ?? []).filter((m) => m.poster_path).slice(0, 20)}
          loading={rec1.isLoading}
        />
      )}
      {tvGenre1 && (rec3.data?.results?.length ?? 0) > 0 && (
        <MediaRow
          title={`Popular ${tvGenre1.name} Shows`}
          icon={<Sparkles className="w-5 h-5" />}
          items={(rec3.data?.results ?? []).filter((m) => m.poster_path).slice(0, 20)}
          loading={rec3.isLoading}
        />
      )}
      {movieGenre2 && (rec2.data?.results?.length ?? 0) > 0 && (
        <MediaRow
          title={`Trending ${movieGenre2.name} Movies`}
          icon={<Sparkles className="w-5 h-5" />}
          items={(rec2.data?.results ?? []).filter((m) => m.poster_path).slice(0, 20)}
          loading={rec2.isLoading}
        />
      )}
    </>
  );
}
