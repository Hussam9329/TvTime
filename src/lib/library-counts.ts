import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const ACTIVE_TV_STATES = ["not_started", "watching", "uptodate", "finished"] as const;

export function eligibleTitleRatingWhere(userId: string): Prisma.MediaWhereInput {
  return {
    userId,
    userRating: { not: null },
    OR: [
      { type: { not: "series" } },
      { type: "series", status: "finished" },
    ],
  };
}

/**
 * Canonical, full-collection counters. These predicates are deliberately shared by
 * Movies, TV Shows, Anime, Stats and the dedicated counts API so pagination can never change a
 * filter badge.
 */
export async function getCanonicalLibraryCounts(userId: string) {
  const base = { userId };
  const eligibleRating = eligibleTitleRatingWhere(userId);
  const eligibleAnimeRating: Prisma.MediaWhereInput = {
    userId,
    isAnime: true,
    userRating: { not: null },
    OR: [
      { type: { not: "series" } },
      { type: "series", status: "finished" },
    ],
  };

  const [
    total,
    movies,
    series,
    books,
    games,
    rated,
    ratedMovies,
    ratedShows,
    ratedAnime,
    watched,
    planned,
    watchlistMovies,
    watchlistShows,
    watchlistAnime,
    watchedMovies,
    watchedShows,
    watchedAnime,
    watchingAnime,
    following,
    watchedEpisodes,
  ] = await Promise.all([
    db.media.count({ where: base }),
    db.media.count({ where: { ...base, type: "movie", isAnime: false } }),
    db.media.count({ where: { ...base, type: "series", isAnime: false } }),
    db.media.count({ where: { ...base, type: "book" } }),
    db.media.count({ where: { ...base, type: "game" } }),
    db.media.count({ where: eligibleRating }),
    db.media.count({ where: { ...base, type: "movie", isAnime: false, userRating: { not: null } } }),
    db.media.count({ where: { ...base, type: "series", status: "finished", isAnime: false, userRating: { not: null } } }),
    db.media.count({ where: eligibleAnimeRating }),
    db.media.count({ where: { ...base, watched: true } }),
    db.media.count({ where: { ...base, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, type: "movie", status: "planned", watched: false, isAnime: false } }),
    db.media.count({ where: { ...base, type: "series", status: "planned", watched: false, isAnime: false } }),
    db.media.count({ where: { ...base, status: "planned", watched: false, isAnime: true } }),
    db.media.count({ where: { ...base, type: "movie", watched: true, isAnime: false } }),
    db.media.count({ where: { ...base, type: "series", watched: true, isAnime: false } }),
    db.media.count({ where: { ...base, watched: true, isAnime: true } }),
    db.media.count({
      where: {
        ...base,
        type: "series",
        isAnime: true,
        watched: false,
        status: { in: ["not_started", "watching", "uptodate"] },
      },
    }),
    db.media.count({ where: { ...base, type: "series", isAnime: false, isFollowing: true } }),
    db.watchedEpisode.count({ where: base }),
  ]);

  return {
    total,
    movies,
    series,
    books,
    games,
    rated,
    ratings: rated,
    ratedMovies,
    ratedShows,
    ratedAnime,
    watched,
    planned,
    watchlist: watchlistMovies + watchlistShows + watchlistAnime,
    watchlistMovies,
    watchlistShows,
    watchlistAnime,
    watchedMovies,
    watchedShows,
    watchedAnime,
    watchingAnime,
    watchedEpisodes,
    following,
  };
}
