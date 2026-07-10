import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };

    const [
      total, movies, series, books, games, rated, watched, planned,
      unratedMovies, unratedSeries, unratedAnime,
      ratedMovies, ratedSeries, ratedAnime,
      watchedEpisodesCount,
      mediaItems,
      watchedEpisodeRows,
    ] = await Promise.all([
      db.media.count({ where: base }),
      db.media.count({ where: { ...base, type: "movie" } }),
      db.media.count({ where: { ...base, type: "series" } }),
      db.media.count({ where: { ...base, type: "book" } }),
      db.media.count({ where: { ...base, type: "game" } }),
      db.media.count({ where: { ...base, userRating: { not: null } } }),
      db.media.count({ where: { ...base, watched: true } }),
      db.media.count({ where: { ...base, status: "planned" } }),
      // Watchlist = unrated (userRating = null)
      db.media.count({ where: { ...base, type: "movie", userRating: null } }),
      db.media.count({ where: { ...base, type: "series", userRating: null, isAnime: false } }),
      db.media.count({ where: { ...base, type: "series", userRating: null, isAnime: true } }),
      // Watched = rated (userRating != null)
      db.media.count({ where: { ...base, type: "movie", userRating: { not: null } } }),
      db.media.count({ where: { ...base, type: "series", userRating: { not: null }, isAnime: false } }),
      db.media.count({ where: { ...base, type: "series", userRating: { not: null }, isAnime: true } }),
      db.watchedEpisode.count({ where: base }),
      db.media.findMany({
        where: { ...base, userRating: { not: null } },
        select: { userRating: true, runtime: true, type: true, episodes: true },
      }),
      db.watchedEpisode.findMany({ where: base }),
    ]);

    const avgRating = mediaItems.length > 0
      ? mediaItems.reduce((s, m) => s + (m.userRating || 0), 0) / mediaItems.length
      : 0;

    const movieMinutes = mediaItems.filter((m) => m.type === "movie").reduce((s, m) => s + (m.runtime || 120), 0);
    const seriesMinutes = mediaItems.filter((m) => m.type === "series").reduce((s, m) => s + ((m.runtime || 45) * Math.max(m.episodes || 1, 1)), 0);
    const episodeMinutes = watchedEpisodeRows.length * 45;
    const totalMinutes = movieMinutes + seriesMinutes + episodeMinutes;

    const showsWatched = new Set(watchedEpisodeRows.map((e) => e.showId));
    const episodesByShowMap = new Map<number, number>();
    for (const e of watchedEpisodeRows) episodesByShowMap.set(e.showId, (episodesByShowMap.get(e.showId) || 0) + 1);

    const ratingDistMap = new Map<number, number>();
    for (const m of mediaItems) {
      if (m.userRating == null) continue;
      ratingDistMap.set(m.userRating, (ratingDistMap.get(m.userRating) || 0) + 1);
    }

    const episodesByMonthMap = new Map<string, number>();
    for (const e of watchedEpisodeRows) {
      const key = e.watchedAt.toISOString().slice(0, 7);
      episodesByMonthMap.set(key, (episodesByMonthMap.get(key) || 0) + 1);
    }

    return NextResponse.json({
      user,
      counts: {
        total, movies, series, books, games, rated, watched, planned,
        // Watchlist = unrated items
        watchlist: unratedMovies + unratedSeries + unratedAnime,
        watchlistMovies: unratedMovies,
        watchlistShows: unratedSeries,
        watchlistAnime: unratedAnime,
        // Watched = rated items
        watchedMovies: ratedMovies,
        watchedShows: ratedSeries,
        watchedAnime: ratedAnime,
        watchedEpisodes: watchedEpisodesCount,
        showsWatched: showsWatched.size,
        following: unratedSeries + unratedAnime,
        ratings: rated,
      },
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
      },
      episodesByShow: Array.from(episodesByShowMap.entries()).map(([showId, count]) => ({ showId, count })),
      moviesByMonth: [],
      episodesByMonth: Array.from(episodesByMonthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDist: Array.from(ratingDistMap.entries()).sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count })),
    });
  } catch (error) {
    console.error("[library:stats]", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
