import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - find or create a Media item from TMDB data
// Used when user adds a movie/show to watchlist or marks as watched from the Home/Discover views
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tmdbId, title, type, poster, year, overview, rating, runtime, genres } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const mediaType = type === "tv" ? "series" : type || "movie";

  // Try to find by tmdbId first
  let item = null;
  if (tmdbId) {
    item = await db.media.findFirst({
      where: { tmdbId: Number(tmdbId) },
    });
  }

  // If not found by tmdbId, try by title + type
  if (!item) {
    item = await db.media.findFirst({
      where: {
        title: { equals: title, mode: "insensitive" },
        type: mediaType,
      },
    });
  }

  // If still not found, create a new one
  if (!item) {
    const id = `tmdb_${tmdbId || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    item = await db.media.create({
      data: {
        id,
        tmdbId: tmdbId ? Number(tmdbId) : null,
        title,
        type: mediaType,
        poster: poster || null,
        year: year || null,
        overview: overview || null,
        rating: rating ? String(rating) : null,
        runtime: runtime || null,
        genres: genres || [],
        status: "planned",
        watched: false,
      },
    });
  } else {
    // Update tmdbId and poster if they were missing
    const updates: any = {};
    if (tmdbId && !item.tmdbId) updates.tmdbId = Number(tmdbId);
    if (poster && !item.poster) updates.poster = poster;
    if (overview && !item.overview) updates.overview = overview;
    if (year && !item.year) updates.year = year;
    if (rating && !item.rating) updates.rating = String(rating);
    if (Object.keys(updates).length > 0) {
      item = await db.media.update({
        where: { id: item.id },
        data: updates,
      });
    }
  }

  return NextResponse.json({ item });
}
