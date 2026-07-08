import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { tmdbId, title, type, poster, year, overview, rating, runtime, genres, seasons, episodes, isAnime } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const mediaType = type === "tv" ? "series" : type || "movie";
    const numericTmdbId = tmdbId ? Number(tmdbId) : null;

    let item = numericTmdbId
      ? await db.media.findFirst({ where: { userId: user.id, tmdbId: numericTmdbId, type: mediaType } })
      : null;

    if (!item) {
      item = await db.media.findFirst({
        where: { userId: user.id, title: { equals: title }, type: mediaType },
      });
    }

    if (!item) {
      item = await db.media.create({
        data: {
          userId: user.id,
          tmdbId: numericTmdbId,
          title: title.trim(),
          type: mediaType,
          poster: poster || null,
          year: year || null,
          overview: overview || null,
          rating: rating != null ? String(rating) : null,
          runtime: runtime != null ? Number(runtime) : null,
          seasons: seasons != null ? Number(seasons) : null,
          episodes: episodes != null ? Number(episodes) : null,
          genres: Array.isArray(genres) ? genres : [],
          isAnime: Boolean(isAnime),
          status: "planned",
          watched: false,
        },
      });
    } else {
      const updates: any = {};
      if (numericTmdbId && !item.tmdbId) updates.tmdbId = numericTmdbId;
      if (poster && !item.poster) updates.poster = poster;
      if (overview && !item.overview) updates.overview = overview;
      if (year && !item.year) updates.year = year;
      if (rating != null && !item.rating) updates.rating = String(rating);
      if (runtime != null && !item.runtime) updates.runtime = Number(runtime);
      if (seasons != null && !item.seasons) updates.seasons = Number(seasons);
      if (episodes != null && !item.episodes) updates.episodes = Number(episodes);
      if (Array.isArray(genres) && item.genres.length === 0) updates.genres = genres;
      if (isAnime !== undefined) updates.isAnime = Boolean(isAnime);
      if (Object.keys(updates).length > 0) {
        item = await db.media.update({ where: { id: item.id }, data: updates });
      }
    }

    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    console.error("[media:find-or-create]", error);
    return NextResponse.json({ error: "Failed to save media item" }, { status: 500 });
  }
}
