import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { eligibleTitleRatingWhere, getCanonicalLibraryCounts } from "@/lib/library-counts";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };
    const eligibleRating = eligibleTitleRatingWhere(user.id);

    const [counts, watchedEpisodeRows, ratedItems, watchedMovieRows] = await Promise.all([
      getCanonicalLibraryCounts(user.id),
      db.watchedEpisode.findMany({ where: base, select: { showId: true, runtime: true, watchedAt: true } }),
      db.media.findMany({ where: eligibleRating, select: { userRating: true } }),
      db.media.findMany({ where: { ...base, type: "movie", watched: true }, select: { runtime: true, watchedAt: true } }),
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
    const moviesByMonthMap = new Map<string, number>();
    for (const episode of watchedEpisodeRows) {
      episodesByShowMap.set(episode.showId, (episodesByShowMap.get(episode.showId) || 0) + 1);
      const month = episode.watchedAt.toISOString().slice(0, 7);
      episodesByMonthMap.set(month, (episodesByMonthMap.get(month) || 0) + 1);
    }
    for (const movie of watchedMovieRows) {
      if (!movie.watchedAt) continue;
      const month = movie.watchedAt.toISOString().slice(0, 7);
      moviesByMonthMap.set(month, (moviesByMonthMap.get(month) || 0) + 1);
    }

    const ratingDistMap = new Map<number, number>();
    for (const item of ratedItems) {
      if (item.userRating == null) continue;
      ratingDistMap.set(item.userRating, (ratingDistMap.get(item.userRating) || 0) + 1);
    }

    return NextResponse.json({
      user,
      counts: { ...counts, showsWatched: showsWatched.size },
      countsAreGlobal: true,
      source: "Media+WatchedEpisode",
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
      },
      episodesByShow: Array.from(episodesByShowMap.entries())
        .sort((a, b) => b[1] - a[1])  // TVM-25: sort by episode count descending (most watched first)
        .map(([showId, count]) => ({ showId, count })),
      moviesByMonth: Array.from(moviesByMonthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, count]) => ({ month, count })),
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
