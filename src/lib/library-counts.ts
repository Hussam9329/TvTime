import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { INFERRED_ANIME_WHERE, INFERRED_ASIAN_TV_WHERE, INFERRED_NON_ANIME_WHERE, INFERRED_NON_ASIAN_TV_WHERE } from "@/lib/media-classification-server";


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
    isArabic: false,
    AND: [INFERRED_ANIME_WHERE],
    userRating: { not: null },
    OR: [
      { type: { not: "series" } },
      { type: "series", status: "finished" },
    ],
  };
  const standardWorld = { isArabic: false, AND: [INFERRED_NON_ANIME_WHERE, INFERRED_NON_ASIAN_TV_WHERE] } satisfies Prisma.MediaWhereInput;
  const animeWorld = { isArabic: false, AND: [INFERRED_ANIME_WHERE] } satisfies Prisma.MediaWhereInput;
  const asianTvWorld = { isArabic: false, AND: [INFERRED_ASIAN_TV_WHERE] } satisfies Prisma.MediaWhereInput;

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
    watchlistAsianShows,
    watchedMovies,
    watchedShows,
    watchedAnime,
    watchedAsianShows,
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
    db.media.count({ where: { ...base, ...standardWorld, type: "movie" } }),
    db.media.count({ where: { ...base, ...standardWorld, type: "series" } }),
    db.media.count({ where: eligibleRating }),
    db.media.count({ where: { ...base, ...standardWorld, type: "movie", userRating: { not: null } } }),
    db.media.count({ where: { ...base, ...standardWorld, type: "series", status: "finished", userRating: { not: null } } }),
    db.media.count({ where: eligibleAnimeRating }),
    db.media.count({ where: { ...base, watched: true } }),
    db.media.count({ where: { ...base, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, ...standardWorld, type: "movie", status: "planned", watched: false } }),
    db.media.count({ where: { ...base, ...standardWorld, type: "series", status: "planned", watched: false } }),
    db.media.count({ where: { ...base, ...animeWorld, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, ...asianTvWorld, status: "planned", watched: false } }),
    db.media.count({ where: { ...base, ...standardWorld, type: "movie", watched: true } }),
    db.media.count({ where: { ...base, ...standardWorld, type: "series", watched: true } }),
    db.media.count({ where: { ...base, ...animeWorld, watched: true } }),
    db.media.count({ where: { ...base, ...asianTvWorld, watched: true } }),
    db.media.count({
      where: {
        ...base,
        type: "series",
        ...animeWorld,
        isFollowing: true,
        watched: false,
        status: "not_started",
      },
    }),
    db.media.count({
      where: {
        ...base,
        type: "series",
        ...animeWorld,
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
    db.media.count({ where: { ...base, ...standardWorld, type: "series", isFollowing: true } }),
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
    watchlist: watchlistMovies + watchlistShows + watchlistAnime + watchlistAsianShows + watchlistArabicMovies + watchlistArabicShows,
    watchlistMovies,
    watchlistShows,
    watchlistAnime,
    watchlistAsianShows,
    watchlistArabicMovies,
    watchlistArabicShows,
    watchedMovies,
    watchedShows,
    watchedAnime,
    watchedAsianShows,
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
