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

    // IMPORTANT: never match TMDB-backed movies by title when tmdbId is present.
    // Many movies share the same title across years/remakes. Matching by title was
    // the root cause of Recently Watched showing the right title with another
    // movie's poster. Title fallback is kept only for manually-created items that
    // genuinely do not have a TMDB id.
    if (!item && !numericTmdbId) {
      item = await db.media.findFirst({
        where: { userId: user.id, title: { equals: title.trim() }, type: mediaType },
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
          // Creating metadata must not silently add the title to Watchlist.
          // The explicit action (rate / watch / plan / follow) owns its own state.
          status: null,
          watched: false,
        },
      });
    } else {
      const updates: any = {};
      const safeTitle = title.trim();

      if (numericTmdbId && !item.tmdbId) updates.tmdbId = numericTmdbId;
      if (safeTitle && item.title !== safeTitle) updates.title = safeTitle;

      // When the record is matched by the same TMDB id, incoming TMDB metadata is
      // authoritative. Update a stale/wrong poster instead of keeping the first
      // poster forever; this also heals rows created before this fix.
      if (poster && item.poster !== poster) updates.poster = poster;
      if (overview && item.overview !== overview) updates.overview = overview;
      if (year && item.year !== year) updates.year = year;
      if (rating != null && item.rating !== String(rating)) updates.rating = String(rating);
      if (runtime != null && item.runtime !== Number(runtime)) updates.runtime = Number(runtime);
      if (seasons != null && item.seasons !== Number(seasons)) updates.seasons = Number(seasons);
      if (episodes != null && item.episodes !== Number(episodes)) updates.episodes = Number(episodes);
      if (Array.isArray(genres) && genres.length > 0 && JSON.stringify(item.genres ?? []) !== JSON.stringify(genres)) updates.genres = genres;
      if (isAnime !== undefined && item.isAnime !== Boolean(isAnime)) updates.isAnime = Boolean(isAnime);
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
