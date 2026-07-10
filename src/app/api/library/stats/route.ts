import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

const ACTIVE_STATES = new Set(["planned", "watching", "up_to_date", "completed"]);

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const [mediaRows, watchedEpisodeRows] = await Promise.all([
      db.media.findMany({ where: { userId: user.id } }),
      db.watchedEpisode.findMany({ where: { userId: user.id } }),
    ]);

    const active = mediaRows.filter((item) => ACTIVE_STATES.has(item.libraryState));
    const ratedItems = mediaRows.filter((item) => item.userRating != null);
    const completedMovies = active.filter((item) => item.type === "movie" && item.libraryState === "completed");
    const completedShows = active.filter((item) => item.type === "series" && item.libraryState === "completed");
    const plannedItems = active.filter((item) => item.libraryState === "planned");
    const nonCompletedActive = active.filter((item) => item.libraryState !== "completed");
    const followingShows = active.filter((item) => item.type === "series");

    const avgRating = ratedItems.length
      ? ratedItems.reduce((sum, item) => sum + Number(item.userRating || 0), 0) / ratedItems.length
      : 0;

    const movieMinutes = completedMovies.reduce((sum, item) => sum + (item.runtime || 120), 0);
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

    const moviesByMonthMap = new Map<string, number>();
    for (const movie of completedMovies) {
      if (!movie.watchedAt) continue;
      const month = movie.watchedAt.toISOString().slice(0, 7);
      moviesByMonthMap.set(month, (moviesByMonthMap.get(month) || 0) + 1);
    }

    const ratingDistMap = new Map<number, number>();
    for (const item of ratedItems) {
      const value = Number(item.userRating);
      ratingDistMap.set(value, (ratingDistMap.get(value) || 0) + 1);
    }

    return NextResponse.json({
      user,
      counts: {
        total: active.length,
        movies: active.filter((item) => item.type === "movie").length,
        series: active.filter((item) => item.type === "series").length,
        books: active.filter((item) => item.type === "book").length,
        games: active.filter((item) => item.type === "game").length,
        rated: ratedItems.length,
        ratedMovies: ratedItems.filter((item) => item.type === "movie").length,
        ratedShows: ratedItems.filter((item) => item.type === "series" && !item.isAnime).length,
        ratedAnime: ratedItems.filter((item) => item.type === "series" && item.isAnime).length,
        watched: active.filter((item) => ["completed", "up_to_date"].includes(item.libraryState)).length,
        planned: plannedItems.length,
        watchlist: plannedItems.length,
        watchlistMovies: plannedItems.filter((item) => item.type === "movie").length,
        watchlistShows: nonCompletedActive.filter((item) => item.type === "series" && !item.isAnime).length,
        watchlistAnime: nonCompletedActive.filter((item) => item.type === "series" && item.isAnime).length,
        watching: active.filter((item) => item.libraryState === "watching").length,
        upToDate: active.filter((item) => item.libraryState === "up_to_date").length,
        watchedMovies: completedMovies.length,
        watchedShows: completedShows.filter((item) => !item.isAnime).length,
        watchedAnime: completedShows.filter((item) => item.isAnime).length,
        watchedEpisodes: watchedEpisodeRows.length,
        showsWatched: showsWatched.size,
        following: followingShows.length,
        ratings: ratedItems.length,
      },
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
      },
      episodesByShow: Array.from(episodesByShowMap.entries()).map(([showId, count]) => ({ showId, count })),
      moviesByMonth: Array.from(moviesByMonthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
      episodesByMonth: Array.from(episodesByMonthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDist: Array.from(ratingDistMap.entries()).sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count })),
    });
  } catch (error) {
    console.error("[library:stats]", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
