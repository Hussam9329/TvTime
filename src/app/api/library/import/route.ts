import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { toJsonArray } from "@/lib/media-normalize";
import { getTvRatingEligibility } from "@/lib/tv-rating-eligibility";

// POST - import library data from JSON (merges with existing data)
// Supports version 2 (Media + watchedEpisodes) and version 1 (legacy tables).
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  const body = await req.json();
  const library = body?.library;

  if (!library || typeof library !== "object") {
    return NextResponse.json({ error: "Invalid import format: 'library' object required" }, { status: 400 });
  }

  let imported = {
    media: 0,
    watchedEpisodes: 0,
    watchlist: 0,
    watchedMovies: 0,
    following: 0,
    ratings: 0,
    lockedSeriesRatingsSkipped: 0,
  };
  const deferredSeriesRatings = new Map<number, number>();

  // Media (version 2 format)
  if (Array.isArray(library.media)) {
    for (const item of library.media) {
      if (!item.title || !item.type) continue;
      const itemType = String(item.type);
      const itemTmdbId = item.tmdbId != null ? Number(item.tmdbId) : null;
      const importedUserRating = item.userRating != null
        ? Math.max(0, Math.min(100, Number(item.userRating)))
        : null;
      if (itemType === "series" && itemTmdbId && importedUserRating != null) {
        deferredSeriesRatings.set(itemTmdbId, importedUserRating);
      }

      const whereClause = itemTmdbId != null
        ? { userId: user.id, tmdbId: itemTmdbId, type: itemType }
        : { userId: user.id, title: String(item.title), type: itemType };

      const existing = await db.media.findFirst({ where: whereClause });
      if (existing) {
        // Skip - already exists. Could update in future.
        continue;
      }

      await db.media.create({
        data: {
          userId: user.id,
          tmdbId: itemTmdbId,
          title: String(item.title),
          originalTitle: item.originalTitle || null,
          year: item.year || null,
          type: itemType,
          poster: item.poster || null,
          rating: item.rating != null ? String(item.rating) : null,
          overview: item.overview || null,
          genres: toJsonArray(item.genres),
          episodes: item.episodes != null ? Number(item.episodes) : null,
          seasons: item.seasons != null ? Number(item.seasons) : null,
          duration: item.duration || null,
          // Imported TV progress is rebuilt from WatchedEpisode rows by the
          // central engine. Never trust a stale whole-show Finished flag.
          status: itemType === "series" ? "not_started" : (item.status || null),
          author: item.author || null,
          pages: item.pages != null ? Number(item.pages) : null,
          tags: toJsonArray(item.tags),
          notes: item.notes || null,
          watched: itemType === "series" ? false : Boolean(item.watched),
          watchedAt: itemType === "series"
            ? null
            : (item.watchedAt ? new Date(item.watchedAt) : null),
          // Whole-series ratings are applied only after the import has restored
          // episode progress and the official ending can be verified.
          userRating: itemType === "series" ? null : importedUserRating,
          rewatch: Boolean(item.rewatch),
          runtime: item.runtime != null ? Number(item.runtime) : null,
          ratingStatus: item.ratingStatus || null,
          isAnime: Boolean(item.isAnime),
        },
      });
      imported.media++;
    }
  }

  // Watched episodes (version 2 format)
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

  // Apply deferred whole-series ratings only after watched episodes have
  // been restored. This closes the import bypass around the server-side lock.
  for (const [tmdbId, value] of deferredSeriesRatings) {
    const eligibility = await getTvRatingEligibility(user.id, tmdbId);
    if (!eligibility.allowed) {
      imported.lockedSeriesRatingsSkipped++;
      continue;
    }
    const updated = await db.media.updateMany({
      where: { userId: user.id, tmdbId, type: "series" },
      data: { userRating: value },
    });
    if (updated.count > 0) imported.ratings++;
  }

  // Legacy watchlist (version 1) -> create Media with status="planned"
  if (Array.isArray(library.watchlist)) {
    for (const item of library.watchlist) {
      if (!item.mediaType || !item.tmdbId || !item.title) continue;
      const mediaType = item.mediaType === "tv" ? "series" : "movie";
      const existing = await db.media.findFirst({
        where: { userId: user.id, tmdbId: Number(item.tmdbId), type: mediaType },
      });
      if (!existing) {
        await db.media.create({
          data: {
            userId: user.id,
            tmdbId: Number(item.tmdbId),
            title: String(item.title),
            type: mediaType,
            poster: item.posterPath || null,
            overview: item.overview || null,
            year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : null,
            rating: item.voteAverage != null ? String(item.voteAverage) : null,
            status: "planned",
            watched: false,
          },
        });
      }
      imported.watchlist++;
    }
  }

  // Legacy watchedMovies (version 1) -> create Media with watched=true
  if (Array.isArray(library.watchedMovies)) {
    for (const item of library.watchedMovies) {
      if (!item.tmdbId || !item.title) continue;
      const existing = await db.media.findFirst({
        where: { userId: user.id, tmdbId: Number(item.tmdbId), type: "movie" },
      });
      if (!existing) {
        await db.media.create({
          data: {
            userId: user.id,
            tmdbId: Number(item.tmdbId),
            title: String(item.title),
            type: "movie",
            poster: item.posterPath || null,
            runtime: item.runtime || null,
            watched: true,
            status: "watched",
          },
        });
      }
      imported.watchedMovies++;
    }
  }

  // Legacy following (version 1) -> create Media (series) with status="not_started"
  if (Array.isArray(library.following)) {
    for (const item of library.following) {
      if (!item.tmdbId || !item.title) continue;
      const existing = await db.media.findFirst({
        where: { userId: user.id, tmdbId: Number(item.tmdbId), type: "series" },
      });
      if (!existing) {
        await db.media.create({
          data: {
            userId: user.id,
            tmdbId: Number(item.tmdbId),
            title: String(item.title),
            type: "series",
            poster: item.posterPath || null,
            status: "not_started",
            watched: false,
          },
        });
      }
      imported.following++;
    }
  }

  // Legacy ratings (version 1) -> upsert Media with userRating. A TV
  // rating is imported only when the show is officially ended and all final
  // episodes are present in watched progress; movies remain independent.
  if (Array.isArray(library.ratings)) {
    for (const item of library.ratings) {
      if (!item.mediaType || !item.tmdbId || item.value == null) continue;
      const mediaType = item.mediaType === "tv" ? "series" : "movie";
      const tmdbId = Number(item.tmdbId);
      const value = Math.max(1, Math.min(100, Number(item.value) * 10));
      const existing = await db.media.findFirst({
        where: { userId: user.id, tmdbId, type: mediaType },
      });

      if (mediaType === "series") {
        const eligibility = await getTvRatingEligibility(user.id, tmdbId);
        if (!eligibility.allowed) {
          imported.lockedSeriesRatingsSkipped++;
          continue;
        }
      }

      if (existing) {
        if (existing.userRating == null) {
          await db.media.update({
            where: { id: existing.id },
            data: { userRating: value },
          });
        }
      } else {
        await db.media.create({
          data: {
            userId: user.id,
            tmdbId,
            title: item.title || "Unknown",
            type: mediaType,
            poster: item.posterPath || null,
            userRating: value,
            watched: false,
            status: mediaType === "series" ? "finished" : null,
          },
        });
      }
      imported.ratings++;
    }
  }

  return NextResponse.json({ ok: true, imported });
}
