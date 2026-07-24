import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { eligibleTitleRatingWhere, getCanonicalLibraryCounts } from "@/lib/library-counts";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };
    const eligibleRating = eligibleTitleRatingWhere(user.id);

    const [counts, watchedEpisodeRows, ratedItems, watchedMovieRows, watchedMedia, episodeRewatchRows] = await Promise.all([
      getCanonicalLibraryCounts(user.id),
      db.watchedEpisode.findMany({ where: base, select: { showId: true, runtime: true, watchedAt: true } }),
      db.media.findMany({ where: eligibleRating, select: { userRating: true } }),
      db.media.findMany({ where: { ...base, type: "movie", watched: true }, select: { runtime: true, watchedAt: true, rewatchCount: true } }),
      db.media.findMany({ where: { ...base, OR: [{ type: "movie", watched: true }, { type: "series", status: { in: ["watching", "uptodate", "finished"] } }] }, select: { tmdbId: true, title: true, type: true, genres: true, year: true, episodes: true, userRating: true } }),
      db.watchSession.findMany({
        where: { ...base, rewatch: true, season: { not: null }, episode: { not: null } },
        select: { duration: true },
      }),
    ]);

    const avgRating = ratedItems.length > 0
      ? ratedItems.reduce((sum, item) => sum + (item.userRating || 0), 0) / ratedItems.length
      : 0;
    const movieBaseMinutes = watchedMovieRows.reduce((sum, movie) => sum + (movie.runtime || 120), 0);
    const movieRewatchMinutes = watchedMovieRows.reduce(
      (sum, movie) => sum + (movie.runtime || 120) * Math.max(0, movie.rewatchCount),
      0,
    );
    const episodeBaseMinutes = watchedEpisodeRows.reduce((sum, episode) => sum + (episode.runtime || 45), 0);
    const episodeRewatchMinutes = episodeRewatchRows.reduce((sum, session) => sum + (session.duration || 45), 0);
    const movieMinutes = movieBaseMinutes + movieRewatchMinutes;
    const episodeMinutes = episodeBaseMinutes + episodeRewatchMinutes;
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

    const genreMap = new Map<string, number>();
    const yearMap = new Map<string, number>();
    for (const item of watchedMedia) {
      for (const genre of item.genres) genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      if (item.year) yearMap.set(item.year, (yearMap.get(item.year) || 0) + 1);
    }
    const topGenres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([genre, count]) => ({ genre, count }));
    const bestYear = [...yearMap.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0] ?? null;
    const longestShow = watchedMedia.filter((item) => item.type === "series" && item.episodes).sort((a, b) => Number(b.episodes || 0) - Number(a.episodes || 0))[0] ?? null;

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
        rewatchMinutes: movieRewatchMinutes + episodeRewatchMinutes,
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
      insights: {
        topGenres,
        bestYear: bestYear ? { year: bestYear[0], count: bestYear[1] } : null,
        longestShow: longestShow ? { tmdbId: longestShow.tmdbId, title: longestShow.title, episodes: longestShow.episodes } : null,
      },
    });
  } catch (error) {
    console.error("[library:stats]", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
