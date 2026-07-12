import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { toJsonArray } from "@/lib/media-normalize";
import { getTvRatingEligibility } from "@/lib/tv-rating-eligibility";

type MediaImportCreateData = {
  userId: string;
  tmdbId?: number | null;
  title: string;
  originalTitle?: string | null;
  year?: string | null;
  type: string;
  poster?: string | null;
  rating?: string | null;
  overview?: string | null;
  genres?: string[];
  episodes?: number | null;
  seasons?: number | null;
  duration?: string | null;
  status?: string | null;
  author?: string | null;
  pages?: number | null;
  tags?: string[];
  notes?: string | null;
  watched?: boolean;
  watchedAt?: Date | null;
  userRating?: number | null;
  rewatch?: boolean;
  runtime?: number | null;
  ratingStatus?: string | null;
  isAnime?: boolean;
  isArabic?: boolean;
  originalLanguage?: string | null;
  originCountries?: string[];
  isFollowing?: boolean;
  addedAt?: Date;
};

async function createMediaSafely({ data }: { data: MediaImportCreateData }) {
  const tmdbId = data.tmdbId == null ? null : Number(data.tmdbId);
  if (tmdbId != null && Number.isInteger(tmdbId) && tmdbId > 0) {
    return db.media.upsert({
      where: {
        userId_type_tmdbId: {
          userId: String(data.userId),
          type: String(data.type),
          tmdbId,
        },
      },
      create: { ...data, tmdbId },
      update: {},
    });
  }
  return db.media.create({ data });
}

// POST - import library data from JSON (merges with existing data)
// Supports version 4 (Arabic classification metadata), versions 2/3, and version 1 legacy tables.
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
    episodeRatings: 0,
    lockedSeriesRatingsSkipped: 0,
  };
  const deferredSeriesRatings = new Map<number, number>();

  // Media (versions 2-4 format)
  if (Array.isArray(library.media)) {
    for (const item of library.media) {
      if (!item.title || !item.type) continue;
      const itemType = String(item.type) === "tv" ? "series" : String(item.type);
      const itemTmdbId = item.tmdbId != null ? Number(item.tmdbId) : null;
      const importedUserRating = item.userRating != null
        ? Math.max(0, Math.min(100, Number(item.userRating)))
        : null;
      if (itemType === "series" && itemTmdbId && importedUserRating != null) {
        deferredSeriesRatings.set(itemTmdbId, importedUserRating);
      }

      const importedIsFollowing = itemType === "series" && (
        typeof item.isFollowing === "boolean"
          ? item.isFollowing
          : ["not_started", "watching", "uptodate", "finished"].includes(String(item.status || ""))
      );
      const whereClause = itemTmdbId != null
        ? { userId: user.id, tmdbId: itemTmdbId, type: itemType }
        : { userId: user.id, title: String(item.title), type: itemType };

      const existing = await db.media.findFirst({ where: whereClause });
      if (existing) {
        // Imports merge conservatively. A new export can explicitly preserve
        // isFollowing=false while retaining episode progress; older exports
        // without the field fall back to their legacy active status.
        const importedOriginCountries = toJsonArray(item.originCountries || item.originCountry)
          .map((country) => String(country).trim().toUpperCase())
          .filter(Boolean);
        const importedOriginalLanguage = typeof item.originalLanguage === "string"
          ? item.originalLanguage.trim().toLowerCase() || null
          : null;
        const shouldPromoteArabic = item.isArabic === true && !existing.isArabic;
        const shouldFillMetadata = (!existing.originalLanguage && importedOriginalLanguage)
          || (existing.originCountries.length === 0 && importedOriginCountries.length > 0);
        if ((itemType === "series" && importedIsFollowing && !existing.isFollowing) || shouldPromoteArabic || shouldFillMetadata) {
          await db.media.update({
            where: { id: existing.id },
            data: {
              ...(itemType === "series" && importedIsFollowing && !existing.isFollowing
                ? { isFollowing: true, ...(existing.status ? {} : { status: "not_started" }) }
                : {}),
              ...(shouldPromoteArabic ? { isArabic: true, isAnime: false } : {}),
              ...(!existing.originalLanguage && importedOriginalLanguage ? { originalLanguage: importedOriginalLanguage } : {}),
              ...(existing.originCountries.length === 0 && importedOriginCountries.length > 0
                ? { originCountries: importedOriginCountries }
                : {}),
            },
          });
        }
        continue;
      }

      await createMediaSafely({
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
          isAnime: Boolean(item.isAnime) && item.isArabic !== true,
          isArabic: Boolean(item.isArabic),
          originalLanguage: typeof item.originalLanguage === "string" ? item.originalLanguage.trim().toLowerCase() || null : null,
          originCountries: toJsonArray(item.originCountries || item.originCountry)
            .map((country) => String(country).trim().toUpperCase())
            .filter(Boolean),
          isFollowing: importedIsFollowing,
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


  // Version 3 independent episode ratings. These remain in Rating because they
  // are episode-level data, not a competing title-library source.
  if (Array.isArray(library.episodeRatings)) {
    for (const item of library.episodeRatings) {
      if (!item?.mediaType?.startsWith?.("episode:") || !item.tmdbId || item.value == null) continue;
      const match = String(item.mediaType).match(/^episode:(\d+):(\d+)$/);
      if (!match) continue;
      const seasonNumber = Number(match[1]);
      const episodeNumber = Number(match[2]);
      const watched = await db.watchedEpisode.findFirst({
        where: { userId: user.id, showId: Number(item.tmdbId), seasonNumber, episodeNumber },
        select: { id: true },
      });
      if (!watched) continue;
      await db.rating.upsert({
        where: {
          userId_mediaType_tmdbId: {
            userId: user.id,
            mediaType: String(item.mediaType),
            tmdbId: Number(item.tmdbId),
          },
        },
        create: {
          userId: user.id,
          mediaType: String(item.mediaType),
          tmdbId: Number(item.tmdbId),
          title: item.title || `TV Show #${item.tmdbId} — S${seasonNumber}E${episodeNumber}`,
          posterPath: item.posterPath || null,
          value: Math.max(0, Math.min(100, Number(item.value))),
        },
        update: {
          value: Math.max(0, Math.min(100, Number(item.value))),
          title: item.title || `TV Show #${item.tmdbId} — S${seasonNumber}E${episodeNumber}`,
          posterPath: item.posterPath || null,
        },
      });
      imported.episodeRatings++;
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
        await createMediaSafely({
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
        await createMediaSafely({
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
      if (existing) {
        await db.media.update({
          where: { id: existing.id },
          data: {
            isFollowing: true,
            ...(existing.status ? {} : { status: "not_started" }),
          },
        });
      } else {
        await createMediaSafely({
          data: {
            userId: user.id,
            tmdbId: Number(item.tmdbId),
            title: String(item.title),
            type: "series",
            poster: item.posterPath || null,
            status: "not_started",
            isFollowing: true,
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
        await createMediaSafely({
          data: {
            userId: user.id,
            tmdbId,
            title: item.title || "Unknown",
            type: mediaType,
            poster: item.posterPath || null,
            userRating: value,
            watched: false,
            status: null,
            ratingStatus: mediaType === "series" ? "imported_after_completion_verification" : null,
          },
        });
      }
      imported.ratings++;
    }
  }

  return NextResponse.json({ ok: true, imported });
}
