import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { classifyMediaWorld } from "@/lib/media-world-classification";


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
  const [storedMedia, watchedEpisodes] = await Promise.all([
    db.media.findMany({ where: { userId } }),
    db.watchedEpisode.count({ where: { userId } }),
  ]);
  // Counts are a read-time aggregate and must never wait for an external
  // metadata request per library item. Cached/stored classification is enough.
  const media = await resolveGeneralMediaClassifications(storedMedia, { allowNetwork: false });
  const classified = media.map((item) => ({
    item,
    world: classifyMediaWorld(item).collectionWorld,
  }));
  const count = (predicate: (entry: (typeof classified)[number]) => boolean) =>
    classified.filter(predicate).length;
  const isPlanned = ({ item }: (typeof classified)[number]) =>
    item.status === "planned" && item.watched === false;
  const hasEligibleRating = ({ item }: (typeof classified)[number]) =>
    item.userRating != null && (item.type !== "series" || item.status === "finished");
  const isWatching = (status: string | null) => status === "watching" || status === "uptodate";

  const total = classified.length;
  const movieWatchlistAll = count((entry) => entry.item.type === "movie" && isPlanned(entry));
  const watchedMoviesAll = count(({ item }) => item.type === "movie" && item.watched);
  const seriesAll = count(({ item }) => item.type === "series");
  const animeTitles = count(({ world }) => world === "anime");
  const arabicMovies = count(({ world }) => world === "arabic-movies");
  const arabicShows = count(({ world }) => world === "arabic-tv");
  const asianMovies = count(({ world }) => world === "asian-movies");
  const asianShows = count(({ world }) => world === "asian-tv");
  const movies = count(({ world }) => world === "movies");
  const series = count(({ world }) => world === "standard-tv");
  const rated = count(hasEligibleRating);
  const ratedMovies = count((entry) => entry.world === "movies" && entry.item.userRating != null);
  const ratedShows = count((entry) =>
    entry.world === "standard-tv" && entry.item.status === "finished" && entry.item.userRating != null);
  const ratedAnime = count((entry) => entry.world === "anime" && hasEligibleRating(entry));
  const ratedAsianMovies = count((entry) => entry.world === "asian-movies" && entry.item.userRating != null);
  const watched = count(({ item }) => item.watched);
  const planned = count(isPlanned);
  const watchlistMovies = count((entry) => entry.world === "movies" && isPlanned(entry));
  const watchlistShows = count((entry) => entry.world === "standard-tv" && isPlanned(entry));
  const watchlistAnime = count((entry) => entry.world === "anime" && isPlanned(entry));
  const watchlistAsianShows = count((entry) => entry.world === "asian-tv" && isPlanned(entry));
  const watchlistAsianMovies = count((entry) => entry.world === "asian-movies" && isPlanned(entry));
  const watchedMovies = count(({ item, world }) => world === "movies" && item.watched);
  const watchedShows = count(({ item, world }) => world === "standard-tv" && item.watched);
  const watchedAnime = count(({ item, world }) => world === "anime" && item.watched);
  const watchedAsianShows = count(({ item, world }) => world === "asian-tv" && item.watched);
  const watchedAsianMovies = count(({ item, world }) => world === "asian-movies" && item.watched);
  const notStartedAnime = count(({ item, world }) =>
    world === "anime"
    && item.type === "series"
    && item.isFollowing
    && !item.watched
    && item.status === "not_started");
  const watchingAnime = count(({ item, world }) =>
    world === "anime" && item.type === "series" && !item.watched && isWatching(item.status));
  const watchlistArabicMovies = count((entry) => entry.world === "arabic-movies" && isPlanned(entry));
  const watchedArabicMovies = count(({ item, world }) => world === "arabic-movies" && item.watched);
  const watchlistArabicShows = count((entry) => entry.world === "arabic-tv" && isPlanned(entry));
  const notStartedArabicShows = count(({ item, world }) =>
    world === "arabic-tv" && item.isFollowing && !item.watched && item.status === "not_started");
  const watchingArabicShows = count(({ item, world }) =>
    world === "arabic-tv" && !item.watched && isWatching(item.status));
  const finishedArabicShows = count(({ item, world }) =>
    world === "arabic-tv" && item.status === "finished");
  const followingArabicShows = count(({ item, world }) =>
    world === "arabic-tv" && item.isFollowing);
  const following = count(({ item, world }) =>
    world === "standard-tv" && item.isFollowing);

  return {
    total,
    movieWatchlistAll,
    watchedMoviesAll,
    seriesAll,
    animeTitles,
    arabicMovies,
    arabicShows,
    asianMovies,
    asianShows,
    movies,
    series,
    rated,
    ratings: rated,
    ratedMovies,
    ratedShows,
    ratedAnime,
    watched,
    planned,
    watchlist: watchlistMovies + watchlistShows + watchlistAnime + watchlistAsianMovies + watchlistAsianShows + watchlistArabicMovies + watchlistArabicShows,
    watchlistMovies,
    watchlistShows,
    watchlistAnime,
    watchlistAsianShows,
    watchlistAsianMovies,
    watchlistArabicMovies,
    watchlistArabicShows,
    watchedMovies,
    watchedShows,
    watchedAnime,
    watchedAsianShows,
    watchedAsianMovies,
    ratedAsianMovies,
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
