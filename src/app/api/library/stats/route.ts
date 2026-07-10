import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };

    const [
      total, movies, series, books, games, rated, watched, planned,
      watchlistMovies, watchlistSeries, watchlistAnime,
      watchedMovies, watchedSeries, watchedAnime,
      watchedEpisodeRows, ratedItems, watchedMovieRows, following,
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
      db.media.count({ where: { ...base, type: "series", status: "planned", isAnime: false } }),
      db.media.count({ where: { ...base, type: "series", status: "planned", isAnime: true } }),
      db.media.count({ where: { ...base, type: "movie", watched: true } }),
      db.media.count({ where: { ...base, type: "series", watched: true, isAnime: false } }),
      db.media.count({ where: { ...base, type: "series", watched: true, isAnime: true } }),
      db.watchedEpisode.findMany({ where: base, select: { showId: true, runtime: true, watchedAt: true } }),
      db.media.findMany({ where: { ...base, userRating: { not: null } }, select: { userRating: true } }),
      db.media.findMany({ where: { ...base, type: "movie", watched: true }, select: { runtime: true } }),
      db.media.count({ where: { ...base, type: "series", status: { in: ["not_started", "watching", "uptodate", "finished"] } } }),
    ]);

    const avgRating = ratedItems.length > 0
      ? ratedItems.reduce((sum, item) => sum + (item.userRating || 0), 0) / ratedItems.length
      : 0;
    const movieMinutes = watchedMovieRows.reduce((sum, movie) => sum + (movie.runtime || 120), 0);
    const episodeMinutes = watchedEpisodeRows.reduce((sum, episode) => sum + (episode.runtime || 45), 0);
    const totalMinutes = movieMinutes + episodeMinutes;

    const showsWatched = new Set(watchedEpisodeRows.map((episode) => episode.showId));
    const episodesByShowMap = new Map<number, number>();
    const episodesByMonthMap = new Map<string, number>();
    for (const episode of watchedEpisodeRows) {
      episodesByShowMap.set(episode.showId, (episodesByShowMap.get(episode.showId) || 0) + 1);
      const month = episode.watchedAt.toISOString().slice(0, 7);
      episodesByMonthMap.set(month, (episodesByMonthMap.get(month) || 0) + 1);
    }

    const ratingDistMap = new Map<number, number>();
    for (const item of ratedItems) {
      if (item.userRating == null) continue;
      ratingDistMap.set(item.userRating, (ratingDistMap.get(item.userRating) || 0) + 1);
    }

    return NextResponse.json({
      user,
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
        showsWatched: showsWatched.size,
        following,
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
      episodesByMonth: Array.from(episodesByMonthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, count]) => ({ month, count })),
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDist: Array.from(ratingDistMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([value, count]) => ({ value, count })),
    });
  } catch (error) {
    console.error("[library:stats]", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
