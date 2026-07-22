import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";


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
    isArabic: false,
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
    notStartedAnime,
    watchingAnime,
    watchlistArabicMovies,
    watchedArabicMovies,
    watchlistArabicShows,
    notStartedArabicShows,
    watchingArabicShows,
    finishedArabicShows,
    followingArabicShows,
    following,
    watchedEpisodes,
  ] = await Promise.all([
    db.media.count({ where: base }),
    db.media.count({ where: { ...base, type: "movie", isAnime: false, isArabic: false } }),
    db.media.count({ where: { ...base, type: "series", isAnime: false, isArabic: false } }),
    db.media.count({ where: eligibleRating }),
    db.media.count({ where: { ...base, type: "movie", isAnime: false, isArabic: false, userRating: { not: null } } }),
    db.media.count({ where: { ...base, type: "series", status: "finished", isAnime: false, isArabic: false, userRating: { not: null } } }),
    db.media.count({ where: eligibleAnimeRating }),
    db.media.count({ where: { ...base, watched: true } }),
    db.media.count({ where: { ...base, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, type: "movie", status: "planned", watched: false, isAnime: false, isArabic: false } }),
    db.media.count({ where: { ...base, type: "series", status: "planned", watched: false, isAnime: false, isArabic: false } }),
    db.media.count({ where: { ...base, status: "planned", watched: false, isAnime: true, isArabic: false } }),
    db.media.count({ where: { ...base, type: "movie", watched: true, isAnime: false, isArabic: false } }),
    db.media.count({ where: { ...base, type: "series", watched: true, isAnime: false, isArabic: false } }),
    db.media.count({ where: { ...base, watched: true, isAnime: true, isArabic: false } }),
    db.media.count({
      where: {
        ...base,
        type: "series",
        isAnime: true,
        isArabic: false,
        isFollowing: true,
        watched: false,
        status: "not_started",
      },
    }),
    db.media.count({
      where: {
        ...base,
        type: "series",
        isAnime: true,
        isArabic: false,
        watched: false,
        status: { in: ["watching", "uptodate"] },
      },
    }),
    db.media.count({ where: { ...base, type: "movie", isArabic: true, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, type: "movie", isArabic: true, watched: true } }),
    db.media.count({ where: { ...base, type: "series", isArabic: true, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, type: "series", isArabic: true, isFollowing: true, watched: false, status: "not_started" } }),
    db.media.count({ where: { ...base, type: "series", isArabic: true, watched: false, status: { in: ["watching", "uptodate"] } } }),
    db.media.count({ where: { ...base, type: "series", isArabic: true, status: "finished" } }),
    db.media.count({ where: { ...base, type: "series", isArabic: true, isFollowing: true } }),
    db.media.count({ where: { ...base, type: "series", isAnime: false, isArabic: false, isFollowing: true } }),
    db.watchedEpisode.count({ where: base }),
  ]);

  return {
    total,
    movies,
    series,
    rated,
    ratings: rated,
    ratedMovies,
    ratedShows,
    ratedAnime,
    watched,
    planned,
    watchlist: watchlistMovies + watchlistShows + watchlistAnime + watchlistArabicMovies + watchlistArabicShows,
    watchlistMovies,
    watchlistShows,
    watchlistAnime,
    watchlistArabicMovies,
    watchlistArabicShows,
    watchedMovies,
    watchedShows,
    watchedAnime,
    notStartedAnime,
    watchingAnime,
    watchedArabicMovies,
    notStartedArabicShows,
    watchingArabicShows,
    finishedArabicShows,
    followingArabicShows,
    watchedEpisodes,
    following,
  };
}
