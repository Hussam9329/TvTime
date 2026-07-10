import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };
    // A whole-series rating is statistically valid only after the show is
    // officially finished by the TV state engine. Episode ratings live in the
    // separate Rating records and never count as a full-series rating.
    const eligibleRatingWhere: Prisma.MediaWhereInput = {
      ...base,
      userRating: { not: null },
      OR: [
        { type: { not: "series" } },
        { type: "series", status: "finished" },
      ],
    };

    const [
      total, movies, series, books, games, rated, watched, planned,
      watchlistMovies, watchlistSeries, watchlistAnime,
      watchedMovies, watchedSeries, watchedAnime,
      ratingDist, topRatedRaw, typeDist, recentlyAddedRaw,
      allRated, watchedMovieRows, watchedEpisodeRows, following,
    ] = await Promise.all([
      db.media.count({ where: base }),
      db.media.count({ where: { ...base, type: "movie" } }),
      db.media.count({ where: { ...base, type: "series" } }),
      db.media.count({ where: { ...base, type: "book" } }),
      db.media.count({ where: { ...base, type: "game" } }),
      db.media.count({ where: eligibleRatingWhere }),
      db.media.count({ where: { ...base, watched: true } }),
      db.media.count({ where: { ...base, status: "planned" } }),
      db.media.count({ where: { ...base, type: "movie", status: "planned" } }),
      db.media.count({ where: { ...base, type: "series", isAnime: false, status: "planned" } }),
      db.media.count({ where: { ...base, type: "series", isAnime: true, status: "planned" } }),
      db.media.count({ where: { ...base, type: "movie", watched: true } }),
      db.media.count({ where: { ...base, type: "series", watched: true, isAnime: false } }),
      db.media.count({ where: { ...base, type: "series", watched: true, isAnime: true } }),
      db.media.groupBy({
        by: ["userRating"],
        where: eligibleRatingWhere,
        _count: true,
        orderBy: { userRating: "asc" },
      }),
      db.media.findMany({ where: eligibleRatingWhere, orderBy: { userRating: "desc" }, take: 10 }),
      db.media.groupBy({ by: ["type"], where: base, _count: true }),
      db.media.findMany({ where: base, orderBy: { addedAt: "desc" }, take: 10 }),
      db.media.findMany({ where: eligibleRatingWhere, select: { userRating: true } }),
      db.media.findMany({ where: { ...base, type: "movie", watched: true }, select: { runtime: true } }),
      db.watchedEpisode.findMany({ where: base, select: { runtime: true } }),
      db.media.count({ where: { ...base, type: "series", status: { in: ["not_started", "watching", "uptodate", "finished"] } } }),
    ]);

    const avgRating = allRated.length > 0
      ? allRated.reduce((sum, item) => sum + (item.userRating || 0), 0) / allRated.length
      : 0;
    const movieMinutes = watchedMovieRows.reduce((sum, item) => sum + (item.runtime || 120), 0);
    const episodeMinutes = watchedEpisodeRows.reduce((sum, item) => sum + (item.runtime || 45), 0);
    const totalMinutes = movieMinutes + episodeMinutes;

    return NextResponse.json({
      counts: {
        total, movies, series, books, games, rated, watched, planned,
        watchlist: watchlistMovies + watchlistSeries + watchlistAnime,
        watchlistMovies,
        watchlistShows: watchlistSeries,
        watchlistAnime,
        watchedMovies,
        watchedShows: watchedSeries,
        watchedAnime,
        watchedEpisodes: watchedEpisodeRows.length,
        following,
        ratings: rated,
      },
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
      },
      ratingDist: ratingDist.map((row) => ({ value: row.userRating, count: row._count })),
      typeDist: typeDist.map((row) => ({ type: row.type, count: row._count })),
      topRated: normalizeMediaMany(topRatedRaw),
      recentlyAdded: normalizeMediaMany(recentlyAddedRaw),
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch (error) {
    console.error("[media:stats]", error);
    return NextResponse.json({ error: "Failed to load media stats" }, { status: 500 });
  }
}
