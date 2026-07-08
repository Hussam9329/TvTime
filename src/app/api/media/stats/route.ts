import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - aggregate media stats
export async function GET(req: NextRequest) {
  const [
    total,
    movies,
    series,
    books,
    games,
    rated,
    watched,
    planned,
    unratedMovies,
    unratedSeries,
    unratedAnime,
    ratedMovies,
    ratedSeries,
    ratedAnime,
  ] = await Promise.all([
    db.media.count(),
    db.media.count({ where: { type: "movie" } }),
    db.media.count({ where: { type: "series" } }),
    db.media.count({ where: { type: "book" } }),
    db.media.count({ where: { type: "game" } }),
    db.media.count({ where: { userRating: { not: null } } }),
    db.media.count({ where: { watched: true } }),
    db.media.count({ where: { status: "planned" } }),
    // Watchlist = unrated items (userRating = null)
    db.media.count({ where: { type: "movie", userRating: null } }),
    db.media.count({ where: { type: "series", userRating: null, isAnime: false } }),
    db.media.count({ where: { type: "series", userRating: null, isAnime: true } }),
    // Watched = rated items (userRating != null)
    db.media.count({ where: { type: "movie", userRating: { not: null } } }),
    db.media.count({ where: { type: "series", userRating: { not: null }, isAnime: false } }),
    db.media.count({ where: { type: "series", userRating: { not: null }, isAnime: true } }),
  ]);

  // Rating distribution
  const ratingDist = await db.media.groupBy({
    by: ["userRating"],
    where: { userRating: { not: null } },
    _count: true,
    orderBy: { userRating: "asc" },
  });

  // Top rated media (by userRating)
  const topRated = await db.media.findMany({
    where: { userRating: { not: null } },
    orderBy: { userRating: "desc" },
    take: 10,
    select: { id: true, title: true, poster: true, userRating: true, type: true, year: true },
  });

  // Type distribution
  const typeDist = await db.media.groupBy({
    by: ["type"],
    _count: true,
  });

  // Recently added
  const recentlyAdded = await db.media.findMany({
    orderBy: { addedAt: "desc" },
    take: 10,
    select: { id: true, title: true, poster: true, type: true, year: true, addedAt: true },
  });

  // Average rating
  const allRated = await db.media.findMany({
    where: { userRating: { not: null } },
    select: { userRating: true, runtime: true, type: true },
  });
  const avgRating = allRated.length > 0 ? allRated.reduce((s, m) => s + (m.userRating || 0), 0) / allRated.length : 0;

  // Watch time: movies with runtime + estimated 45min per series episode
  const movieMinutes = allRated
    .filter((m) => m.type === "movie")
    .reduce((s, m) => s + (m.runtime || 120), 0); // default 120min if no runtime
  const seriesMinutes = allRated
    .filter((m) => m.type === "series")
    .reduce((s, m) => s + (m.runtime || 480), 0); // default 480min (8 episodes) per series
  const totalMinutes = movieMinutes + seriesMinutes;
  const totalHours = Math.round(totalMinutes / 60);

  return NextResponse.json({
    counts: {
      total,
      movies,
      series,
      books,
      games,
      rated,
      watched,
      planned,
      // Watchlist = unrated items
      watchlist: unratedMovies + unratedSeries + unratedAnime,
      watchlistMovies: unratedMovies,
      watchlistShows: unratedSeries,
      watchlistAnime: unratedAnime,
      // Watched = rated items
      watchedMovies: ratedMovies,
      watchedEpisodes: 0, // episode tracking is in localStorage
      following: unratedSeries, // TV shows in watchlist
      ratings: rated,
    },
    watchTime: {
      totalMinutes,
      totalHours,
      movieMinutes,
      episodeMinutes: seriesMinutes,
    },
    ratingDist: ratingDist.map((r) => ({ value: r.userRating, count: r._count })),
    typeDist: typeDist.map((t) => ({ type: t.type, count: t._count })),
    topRated,
    recentlyAdded,
    avgRating: Math.round(avgRating * 10) / 10,
  });
}
