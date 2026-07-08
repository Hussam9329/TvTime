import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - aggregate stats for the user, combining Media + WatchedEpisode tables.
// This powers both the Home view stats and the Library view stats.
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  const base = { userId: user.id };

  const [
    total, movies, series, books, games, rated, watched, planned,
    watchlistMovies, watchlistSeries, watchlistAnime,
    ratedMovies, ratedSeries, ratedAnime,
    watchedEpisodes,
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
    db.media.count({ where: { ...base, type: "movie", status: "planned" } }),
    db.media.count({ where: { ...base, type: "series", isAnime: false, status: "planned" } }),
    db.media.count({ where: { ...base, type: "series", isAnime: true, status: "planned" } }),
    db.media.count({ where: { ...base, type: "movie", watched: true } }),
    db.media.count({ where: { ...base, type: "series", watched: true, isAnime: false } }),
    db.media.count({ where: { ...base, type: "series", watched: true, isAnime: true } }),
    db.watchedEpisode.count({ where: base }),
    db.media.findMany({
      where: { ...base, userRating: { not: null } },
      select: { userRating: true, runtime: true, type: true, episodes: true },
    }),
    db.watchedEpisode.findMany({ where: base }),
  ]);

  // Rating distribution
  const ratingDistMap = new Map<number, number>();
  for (const m of mediaItems) {
    if (m.userRating == null) continue;
    ratingDistMap.set(m.userRating, (ratingDistMap.get(m.userRating) || 0) + 1);
  }
  const ratingDist = Array.from(ratingDistMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value, count }));

  const avgRating = mediaItems.length > 0
    ? mediaItems.reduce((s, m) => s + (m.userRating || 0), 0) / mediaItems.length
    : 0;

  // Watch time
  const movieMinutes = mediaItems
    .filter((m) => m.type === "movie")
    .reduce((s, m) => s + (m.runtime || 120), 0);
  const seriesMinutes = mediaItems
    .filter((m) => m.type === "series")
    .reduce((s, m) => s + ((m.runtime || 45) * Math.max(m.episodes || 1, 1)), 0);
  const episodeMinutes = watchedEpisodeRows.length * 45;
  const totalMinutes = movieMinutes + seriesMinutes + episodeMinutes;

  // Unique shows watched (from episodes table)
  const showsWatched = new Set(watchedEpisodeRows.map((e) => e.showId));

  // Group episodes by show
  const episodesByShowMap = new Map<number, number>();
  for (const e of watchedEpisodeRows) {
    episodesByShowMap.set(e.showId, (episodesByShowMap.get(e.showId) || 0) + 1);
  }

  // Monthly breakdowns (rated movies by updatedAt, episodes by watchedAt)
  const moviesByMonthMap = new Map<string, number>();
  for (const m of mediaItems.filter((m) => m.type === "movie")) {
    // We don't have watchedAt here without a findMany; fall back to skip monthly movie stats
  }
  const episodesByMonthMap = new Map<string, number>();
  for (const e of watchedEpisodeRows) {
    const key = e.watchedAt.toISOString().slice(0, 7);
    episodesByMonthMap.set(key, (episodesByMonthMap.get(key) || 0) + 1);
  }

  return NextResponse.json({
    user,
    counts: {
      total,
      movies,
      series,
      books,
      games,
      rated,
      watched,
      planned,
      watchlist: watchlistMovies + watchlistSeries + watchlistAnime,
      watchlistMovies,
      watchlistShows: watchlistSeries,
      watchlistAnime,
      watchedMovies: ratedMovies,
      watchedShows: ratedSeries,
      watchedAnime: ratedAnime,
      watchedEpisodes,
      showsWatched: showsWatched.size,
      following: watchlistSeries + watchlistAnime,
      ratings: rated,
    },
    watchTime: {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60),
      movieMinutes,
      episodeMinutes,
    },
    episodesByShow: Array.from(episodesByShowMap.entries()).map(([showId, count]) => ({ showId, count })),
    moviesByMonth: Array.from(moviesByMonthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    episodesByMonth: Array.from(episodesByMonthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    avgRating: Math.round(avgRating * 10) / 10,
    ratingDist,
  });
}
