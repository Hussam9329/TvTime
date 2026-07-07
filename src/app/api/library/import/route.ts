import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// POST - import library data from JSON (merges with existing data)
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  const body = await req.json();
  const library = body?.library;

  if (!library || typeof library !== "object") {
    return NextResponse.json({ error: "Invalid import format: 'library' object required" }, { status: 400 });
  }

  let imported = { watchlist: 0, watchedMovies: 0, watchedEpisodes: 0, following: 0, ratings: 0 };

  // Watchlist
  if (Array.isArray(library.watchlist)) {
    for (const item of library.watchlist) {
      if (!item.mediaType || !item.tmdbId || !item.title) continue;
      await db.watchlistItem.upsert({
        where: {
          userId_mediaType_tmdbId: {
            userId: user.id,
            mediaType: item.mediaType,
            tmdbId: Number(item.tmdbId),
          },
        },
        create: {
          userId: user.id,
          mediaType: item.mediaType,
          tmdbId: Number(item.tmdbId),
          title: item.title,
          posterPath: item.posterPath || null,
          backdropPath: item.backdropPath || null,
          overview: item.overview || null,
          releaseDate: item.releaseDate || null,
          voteAverage: item.voteAverage || null,
        },
        update: {},
      });
      imported.watchlist++;
    }
  }

  // Watched movies
  if (Array.isArray(library.watchedMovies)) {
    for (const item of library.watchedMovies) {
      if (!item.tmdbId || !item.title) continue;
      await db.watchedMovie.upsert({
        where: { userId_tmdbId: { userId: user.id, tmdbId: Number(item.tmdbId) } },
        create: {
          userId: user.id,
          tmdbId: Number(item.tmdbId),
          title: item.title,
          posterPath: item.posterPath || null,
          runtime: item.runtime || null,
        },
        update: {},
      });
      imported.watchedMovies++;
    }
  }

  // Watched episodes
  if (Array.isArray(library.watchedEpisodes)) {
    for (const item of library.watchedEpisodes) {
      if (!item.showId || item.seasonNumber == null || item.episodeNumber == null) continue;
      await db.watchedEpisode.upsert({
        where: {
          userId_showId_seasonNumber_episodeNumber: {
            userId: user.id,
            showId: Number(item.showId),
            seasonNumber: Number(item.seasonNumber),
            episodeNumber: Number(item.episodeNumber),
          },
        },
        create: {
          userId: user.id,
          showId: Number(item.showId),
          seasonNumber: Number(item.seasonNumber),
          episodeNumber: Number(item.episodeNumber),
          episodeName: item.episodeName || null,
        },
        update: {},
      });
      imported.watchedEpisodes++;
    }
  }

  // Following
  if (Array.isArray(library.following)) {
    for (const item of library.following) {
      if (!item.tmdbId || !item.title) continue;
      await db.followingShow.upsert({
        where: { userId_tmdbId: { userId: user.id, tmdbId: Number(item.tmdbId) } },
        create: {
          userId: user.id,
          tmdbId: Number(item.tmdbId),
          title: item.title,
          posterPath: item.posterPath || null,
        },
        update: {},
      });
      imported.following++;
    }
  }

  // Ratings
  if (Array.isArray(library.ratings)) {
    for (const item of library.ratings) {
      if (!item.mediaType || !item.tmdbId || item.value == null) continue;
      await db.rating.upsert({
        where: {
          userId_mediaType_tmdbId: {
            userId: user.id,
            mediaType: item.mediaType,
            tmdbId: Number(item.tmdbId),
          },
        },
        create: {
          userId: user.id,
          mediaType: item.mediaType,
          tmdbId: Number(item.tmdbId),
          title: item.title || "Unknown",
          posterPath: item.posterPath || null,
          value: Math.max(1, Math.min(10, Number(item.value))),
        },
        update: {},
      });
      imported.ratings++;
    }
  }

  return NextResponse.json({ ok: true, imported });
}
