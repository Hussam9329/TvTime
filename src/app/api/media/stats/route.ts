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
      db.media.findMany({ where: { ...base, type: "movie", watched: true }, select: { runtime: true } }),
      db.watchedEpisode.findMany({ where: base, select: { runtime: true } }),
    ]);

    const avgRating = allRated.length > 0
      ? allRated.reduce((sum, item) => sum + (item.userRating || 0), 0) / allRated.length
      : 0;
    const movieMinutes = watchedMovieRows.reduce((sum, item) => sum + (item.runtime || 120), 0);
    const episodeMinutes = watchedEpisodeRows.reduce((sum, item) => sum + (item.runtime || 45), 0);
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
