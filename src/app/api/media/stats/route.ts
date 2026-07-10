import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";

const ACTIVE_STATES = ["planned", "watching", "up_to_date", "completed"];

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const [mediaRows, watchedEpisodes] = await Promise.all([
      db.media.findMany({ where: { userId: user.id } }),
      db.watchedEpisode.findMany({ where: { userId: user.id } }),
    ]);

    const active = mediaRows.filter((item) => ACTIVE_STATES.includes(item.libraryState));
    const rated = mediaRows.filter((item) => item.userRating != null);
    const planned = active.filter((item) => item.libraryState === "planned");
    const nonCompletedActive = active.filter((item) => item.libraryState !== "completed");
    const completedMovies = active.filter((item) => item.type === "movie" && item.libraryState === "completed");
    const completedShows = active.filter((item) => item.type === "series" && item.libraryState === "completed");

    const ratingDistMap = new Map<number, number>();
    for (const item of rated) {
      const value = Number(item.userRating);
      ratingDistMap.set(value, (ratingDistMap.get(value) || 0) + 1);
    }

    const typeDistMap = new Map<string, number>();
    for (const item of mediaRows) typeDistMap.set(item.type, (typeDistMap.get(item.type) || 0) + 1);

    const avgRating = rated.length
      ? rated.reduce((sum, item) => sum + Number(item.userRating || 0), 0) / rated.length
      : 0;
    const movieMinutes = completedMovies.reduce((sum, item) => sum + (item.runtime || 120), 0);
    const episodeMinutes = watchedEpisodes.reduce((sum, item) => sum + (item.runtime || 45), 0);
    const totalMinutes = movieMinutes + episodeMinutes;

    const topRatedRaw = [...rated].sort((a, b) => Number(b.userRating || 0) - Number(a.userRating || 0)).slice(0, 10);
    const recentlyAddedRaw = [...mediaRows].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()).slice(0, 10);

    return NextResponse.json({
      counts: {
        total: mediaRows.length,
        movies: mediaRows.filter((item) => item.type === "movie").length,
        series: mediaRows.filter((item) => item.type === "series").length,
        books: mediaRows.filter((item) => item.type === "book").length,
        games: mediaRows.filter((item) => item.type === "game").length,
        rated: rated.length,
        ratedMovies: rated.filter((item) => item.type === "movie").length,
        ratedShows: rated.filter((item) => item.type === "series" && !item.isAnime).length,
        ratedAnime: rated.filter((item) => item.type === "series" && item.isAnime).length,
        watched: active.filter((item) => ["completed", "up_to_date"].includes(item.libraryState)).length,
        planned: planned.length,
        watchlist: planned.length,
        watchlistMovies: planned.filter((item) => item.type === "movie").length,
        watchlistShows: nonCompletedActive.filter((item) => item.type === "series" && !item.isAnime).length,
        watchlistAnime: nonCompletedActive.filter((item) => item.type === "series" && item.isAnime).length,
        watching: active.filter((item) => item.libraryState === "watching").length,
        upToDate: active.filter((item) => item.libraryState === "up_to_date").length,
        watchedMovies: completedMovies.length,
        watchedShows: completedShows.filter((item) => !item.isAnime).length,
        watchedAnime: completedShows.filter((item) => item.isAnime).length,
        watchedEpisodes: watchedEpisodes.length,
        following: active.filter((item) => item.type === "series").length,
        ratings: rated.length,
      },
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
      },
      ratingDist: Array.from(ratingDistMap.entries()).sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count })),
      typeDist: Array.from(typeDistMap.entries()).map(([type, count]) => ({ type, count })),
      topRated: normalizeMediaMany(topRatedRaw),
      recentlyAdded: normalizeMediaMany(recentlyAddedRaw),
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch (error) {
    console.error("[media:stats]", error);
    return NextResponse.json({ error: "Failed to load media stats" }, { status: 500 });
  }
}
