"use client";

import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres, useMedia } from "@/hooks/use-tmdb";
import { MediaRow } from "@/components/media/media-row";
import { Sparkles, Star } from "lucide-react";

/**
 * TVM-42: Personalized recommendations.
 *
 * Instead of random daily genres, derives the user's top genres from their
 * highest-rated movies and TV shows. Falls back to popular genres if the user
 * has no ratings yet.
 *
 * The user's genres come from the stored `genres` array on Media rows that
 * have a high userRating (>= 70). We count genre frequency across those rows
 * and pick the top 2 movie genres + top 1 TV genre.
 */
export function GenreRecommendations() {
  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();

  // TVM-42: Fetch the user's highly-rated media to derive personal genres
  const ratedMovies = useMedia({ type: "movie", rated: "true", limit: 500 });
  const ratedTv = useMedia({ type: "series", rated: "true", limit: 500 });

  // Derive top genres from user's highest-rated items (rating >= 70)
  const userMovieGenres = deriveTopGenres(ratedMovies.data?.items ?? [], movieGenres.data ?? [], 2);
  const userTvGenres = deriveTopGenres(ratedTv.data?.items ?? [], tvGenres.data ?? [], 1);

  // Fallback to daily rotation if user has no ratings
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const movieGenreList = movieGenres.data ?? [];
  const tvGenreList = tvGenres.data ?? [];

  const fallbackMovieGenre1 = movieGenreList[dayOfYear % Math.max(movieGenreList.length, 1)];
  const fallbackMovieGenre2 = movieGenreList[(dayOfYear + 3) % Math.max(movieGenreList.length, 1)];
  const fallbackTvGenre = tvGenreList[(dayOfYear + 1) % Math.max(tvGenreList.length, 1)];

  const movieGenre1 = userMovieGenres[0] || fallbackMovieGenre1;
  const movieGenre2 = userMovieGenres[1] || fallbackMovieGenre2;
  const tvGenre1 = userTvGenres[0] || fallbackTvGenre;

  const isPersonalized = userMovieGenres.length > 0 || userTvGenres.length > 0;

  const rec1 = useDiscoverMovies({ genres: movieGenre1 ? [movieGenre1.id] : undefined, sort_by: "vote_average.desc", page: 1, rating: 7 });
  const rec2 = useDiscoverMovies({ genres: movieGenre2 ? [movieGenre2.id] : undefined, sort_by: "popularity.desc", page: 1 });
  const rec3 = useDiscoverTv({ genres: tvGenre1 ? [tvGenre1.id] : undefined, sort_by: "popularity.desc", page: 1 });

  return (
    <>
      {movieGenre1 && (rec1.data?.results?.length ?? 0) > 0 && (
        <MediaRow
          title={isPersonalized ? `Top ${movieGenre1.name} Movies • For You` : `Top ${movieGenre1.name} Movies`}
          icon={isPersonalized ? <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> : <Sparkles className="w-5 h-5" />}
          items={(rec1.data?.results ?? []).filter((m) => m.poster_path).slice(0, 20)}
          loading={rec1.isLoading}
        />
      )}
      {tvGenre1 && (rec3.data?.results?.length ?? 0) > 0 && (
        <MediaRow
          title={isPersonalized ? `Popular ${tvGenre1.name} Shows • For You` : `Popular ${tvGenre1.name} Shows`}
          icon={isPersonalized ? <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> : <Sparkles className="w-5 h-5" />}
          items={(rec3.data?.results ?? []).filter((m) => m.poster_path).slice(0, 20)}
          loading={rec3.isLoading}
          forcedMediaType="tv"
        />
      )}
      {movieGenre2 && (rec2.data?.results?.length ?? 0) > 0 && (
        <MediaRow
          title={isPersonalized ? `Trending ${movieGenre2.name} Movies • For You` : `Trending ${movieGenre2.name} Movies`}
          icon={isPersonalized ? <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> : <Sparkles className="w-5 h-5" />}
          items={(rec2.data?.results ?? []).filter((m) => m.poster_path).slice(0, 20)}
          loading={rec2.isLoading}
        />
      )}
    </>
  );
}

/**
 * TVM-42: Derive the user's top N genres from their highest-rated media.
 * Counts genre frequency across items with userRating >= 70, then returns
 * the top N Genre objects matched against the official TMDB genre list.
 */
function deriveTopGenres(
  items: any[],
  officialGenres: { id: number; name: string }[],
  count: number,
): { id: number; name: string }[] {
  const genreCounts = new Map<number, number>();

  for (const item of items) {
    // Only consider highly-rated items (>= 70/100)
    if (item.userRating == null || item.userRating < 70) continue;

    // genres is stored as string[] on Media rows
    const genres: string[] = Array.isArray(item.genres) ? item.genres : [];
    for (const genreName of genres) {
      // Match genre name to official TMDB genre ID
      const official = officialGenres.find((g) => g.name.toLowerCase() === String(genreName).toLowerCase());
      if (official) {
        genreCounts.set(official.id, (genreCounts.get(official.id) || 0) + 1);
      }
    }
  }

  // Sort by frequency descending, take top N
  const sorted = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);

  return sorted.map(([id]) => {
    const g = officialGenres.find((og) => og.id === id);
    return g ? { id: g.id, name: g.name } : { id, name: String(id) };
  });
}
