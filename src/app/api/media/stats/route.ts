import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };

    const [
      total, movies, series, books, games, rated, watched, planned,
      watchlistMovies, watchlistSeries, watchlistAnime,
      ratedMovies, ratedSeries, ratedAnime,
    ] = await Promise.all([
      db.media.count({ where: base }),
      db.media.count({ where: { ...base, type: "movie" } }),
      db.media.count({ where: { ...base, type: "series" } }),
      db.media.count({ where: { ...base, type: "book" } }),
      db.media.count({ where: { ...base, type: "game" } }),
      db.media.count({ where: { ...base, userRating: { not: null } } }),
      db.media.count({ where: { ...base, watched: true } }),
      db.media.count({ where: { ...base, status: "planned" } }),
      db.media.count({ where: { ...base, type: "movie", status: "planned" } }),
      db.media.count({ where: { ...base, type: "series", isAnime: false, status: "planned" } }),
      db.media.count({ where: { ...base, type: "series", isAnime: true, status: "planned" } }),
      db.media.count({ where: { ...base, type: "movie", watched: true } }),
      db.media.count({ where: { ...base, type: "series", watched: true, isAnime: false } }),
      db.media.count({ where: { ...base, type: "series", watched: true, isAnime: true } }),
    ]);

    const ratingDist = await db.media.groupBy({
      by: ["userRating"],
      where: { ...base, userRating: { not: null } },
      _count: true,
      orderBy: { userRating: "asc" },
    });

    const topRatedRaw = await db.media.findMany({
      where: { ...base, userRating: { not: null } },
      orderBy: { userRating: "desc" },
      take: 10,
    });

    const typeDist = await db.media.groupBy({ by: ["type"], where: base, _count: true });
    const recentlyAddedRaw = await db.media.findMany({ where: base, orderBy: { addedAt: "desc" }, take: 10 });
    const allRated = await db.media.findMany({ where: { ...base, userRating: { not: null } }, select: { userRating: true, runtime: true, type: true, episodes: true } });

    const avgRating = allRated.length > 0 ? allRated.reduce((s, m) => s + (m.userRating || 0), 0) / allRated.length : 0;
    const movieMinutes = allRated.filter((m) => m.type === "movie").reduce((s, m) => s + (m.runtime || 120), 0);
    const seriesMinutes = allRated.filter((m) => m.type === "series").reduce((s, m) => s + ((m.runtime || 45) * Math.max(m.episodes || 1, 1)), 0);
    const totalMinutes = movieMinutes + seriesMinutes;

    // Also count watched episodes from the WatchedEpisode table
    const watchedEpisodesCount = await db.watchedEpisode.count({ where: base });

    return NextResponse.json({
      counts: {
        total, movies, series, books, games, rated, watched, planned,
        watchlist: watchlistMovies + watchlistSeries + watchlistAnime,
        watchlistMovies, watchlistShows: watchlistSeries, watchlistAnime,
        watchedMovies: ratedMovies, watchedShows: ratedSeries, watchedAnime: ratedAnime,
        watchedEpisodes: watchedEpisodesCount,
        following: watchlistSeries + watchlistAnime,
        ratings: rated,
      },
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes: seriesMinutes,
      },
      ratingDist: ratingDist.map((r) => ({ value: r.userRating, count: r._count })),
      typeDist: typeDist.map((t) => ({ type: t.type, count: t._count })),
      topRated: normalizeMediaMany(topRatedRaw),
      recentlyAdded: normalizeMediaMany(recentlyAddedRaw),
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch (error) {
    console.error("[media:stats]", error);
    return NextResponse.json({ error: "Failed to load media stats" }, { status: 500 });
  }
}
