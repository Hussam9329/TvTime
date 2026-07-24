import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";
import { eligibleTitleRatingWhere, getCanonicalLibraryCounts } from "@/lib/library-counts";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const base = { userId: user.id };
    const eligibleRating = eligibleTitleRatingWhere(user.id);

    const [
      counts,
      ratingDist,
      topRatedRaw,
      typeDist,
      recentlyAddedRaw,
      allRated,
      watchedMovieRows,
      watchedEpisodeRows,
      episodeRewatchRows,
    ] = await Promise.all([
      getCanonicalLibraryCounts(user.id),
      db.media.groupBy({
        by: ["userRating"],
        where: eligibleRating,
        _count: true,
        orderBy: { userRating: "asc" },
      }),
      db.media.findMany({ where: eligibleRating, orderBy: { userRating: "desc" }, take: 10 }),
      db.media.groupBy({ by: ["type"], where: base, _count: true }),
      db.media.findMany({ where: base, orderBy: { addedAt: "desc" }, take: 10 }),
      db.media.findMany({ where: eligibleRating, select: { userRating: true } }),
      db.media.findMany({ where: { ...base, type: "movie", watched: true }, select: { runtime: true, rewatchCount: true } }),
      db.watchedEpisode.findMany({ where: base, select: { runtime: true } }),
      db.watchSession.findMany({
        where: { ...base, rewatch: true, season: { not: null }, episode: { not: null } },
        select: { duration: true },
      }),
    ]);

    const avgRating = allRated.length > 0
      ? allRated.reduce((sum, item) => sum + (item.userRating || 0), 0) / allRated.length
      : 0;
    const movieBaseMinutes = watchedMovieRows.reduce((sum, item) => sum + (item.runtime || 120), 0);
    const movieRewatchMinutes = watchedMovieRows.reduce(
      (sum, item) => sum + (item.runtime || 120) * Math.max(0, item.rewatchCount),
      0,
    );
    const episodeBaseMinutes = watchedEpisodeRows.reduce((sum, item) => sum + (item.runtime || 45), 0);
    const episodeRewatchMinutes = episodeRewatchRows.reduce((sum, session) => sum + (session.duration || 45), 0);
    const movieMinutes = movieBaseMinutes + movieRewatchMinutes;
    const episodeMinutes = episodeBaseMinutes + episodeRewatchMinutes;
    const totalMinutes = movieMinutes + episodeMinutes;

    return NextResponse.json({
      counts,
      countsAreGlobal: true,
      source: "Media+WatchedEpisode",
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
        rewatchMinutes: movieRewatchMinutes + episodeRewatchMinutes,
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
