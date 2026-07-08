import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - aggregate media stats
export async function GET(req: NextRequest) {
  const [total, movies, series, books, games, rated, watched, planned] = await Promise.all([
    db.media.count(),
    db.media.count({ where: { type: "movie" } }),
    db.media.count({ where: { type: "series" } }),
    db.media.count({ where: { type: "book" } }),
    db.media.count({ where: { type: "game" } }),
    db.media.count({ where: { userRating: { not: null } } }),
    db.media.count({ where: { watched: true } }),
    db.media.count({ where: { status: "planned" } }),
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
    select: { userRating: true },
  });
  const avgRating = allRated.length > 0 ? allRated.reduce((s, m) => s + (m.userRating || 0), 0) / allRated.length : 0;

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
    },
    ratingDist: ratingDist.map((r) => ({ value: r.userRating, count: r._count })),
    typeDist: typeDist.map((t) => ({ type: t.type, count: t._count })),
    topRated,
    recentlyAdded,
    avgRating: Math.round(avgRating * 10) / 10,
  });
}
