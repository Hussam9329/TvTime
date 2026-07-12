import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import {
  deriveTvTrackingState,
  episodeKey,
  normalizeTvTrackingState,
  tvStateToMediaPatch,
  type TvTrackingState,
} from "@/lib/tv-status-engine";
import {
  getTvStatusMetadata,
  validateReleasedEpisodeBatch,
  type TvEpisodeRequest,
} from "@/lib/tv-status-server";
import { materializeLegacyCompletionSnapshot } from "@/lib/tv-status-repair";
import { detectIsAnime } from "@/lib/anime-detect";
import { detectIsArabic, normalizeCountryCodes } from "@/lib/arabic-media";
import { canonicalMediaPoster } from "@/lib/media-poster";

type CompletionInfo = {
  newStatus: TvTrackingState;
  isEnded: boolean | null;
  showTmdbId: number;
  mediaId: string;
  needsRating: boolean;
  airedEpisodeCount: number | null;
  watchedAiredEpisodeCount: number;
  ignoredFutureEpisodeCount: number;
  verified: boolean;
};

function classificationFromMetadata(metadata: Awaited<ReturnType<typeof getTvStatusMetadata>>) {
  const originalLanguage = metadata.detail.original_language?.trim().toLowerCase() || null;
  const originCountries = normalizeCountryCodes(metadata.detail.origin_country);
  const genres = (metadata.detail.genres || []).map((genre) => genre.name).filter(Boolean);
  const isArabic = detectIsArabic({ originalLanguage, originCountry: originCountries });
  const isAnime = !isArabic && detectIsAnime({
    originalLanguage,
    originCountry: originCountries,
    genres,
    title: metadata.title,
  });
  return { originalLanguage, originCountries, genres, isArabic, isAnime };
}

function isLegacyCompleted(media: { watched: boolean; status: string | null }, episodeCount: number): boolean {
  const state = normalizeTvTrackingState(media.status);
  return episodeCount === 0 && Boolean(
    media.watched || state === "finished" || state === "uptodate",
  );
}

async function ensureSeriesMedia(userId: string, showTmdbId: number) {
  const identity = { userId, type: "series", tmdbId: showTmdbId };
  const existing = await db.media.findUnique({
    where: { userId_type_tmdbId: identity },
  });
  if (existing) return existing;

  const metadata = await getTvStatusMetadata(showTmdbId);
  const classification = classificationFromMetadata(metadata);
  return db.media.upsert({
    where: { userId_type_tmdbId: identity },
    create: {
      userId,
      tmdbId: showTmdbId,
      title: metadata.title,
      type: "series",
      poster: canonicalMediaPoster(metadata.posterPath),
      overview: metadata.overview,
      genres: classification.genres,
      isArabic: classification.isArabic,
      isAnime: classification.isAnime,
      originalLanguage: classification.originalLanguage,
      originCountries: classification.originCountries,
      year: metadata.firstAirDate?.slice(0, 4) || null,
      episodes: metadata.totalEpisodes,
      seasons: metadata.totalSeasons,
      status: "not_started",
      watched: false,
    },
    update: {},
  });
}

/**
 * The only server-side state transition for TV tracking.
 * Whole-show ratings are intentionally never read or written here.
 */
async function autoUpdateShowStatus(userId: string, showTmdbId: number): Promise<CompletionInfo | null> {
  try {
    const media = await db.media.findUnique({
      where: { userId_type_tmdbId: { userId, type: "series", tmdbId: showTmdbId } },
    });
    if (!media) return null;

    const watchedEpisodes = await db.watchedEpisode.findMany({
      where: { userId, showId: showTmdbId },
      select: { seasonNumber: true, episodeNumber: true, watchedAt: true },
      orderBy: { watchedAt: "desc" },
    });

    let metadata: Awaited<ReturnType<typeof getTvStatusMetadata>> | null = null;
    try {
      metadata = await getTvStatusMetadata(showTmdbId);
    } catch (error) {
      console.warn("[watched-episodes] Unable to verify TV metadata", showTmdbId, error);
    }

    const watchedKeys = watchedEpisodes.map((episode) =>
      episodeKey(episode.seasonNumber, episode.episodeNumber),
    );
    const derived = deriveTvTrackingState({
      persistedStatus: media.status,
      officiallyEnded: metadata ? metadata.officiallyEnded : null,
      airedEpisodeCount: metadata?.airedEpisodeCount ?? null,
      airedEpisodeKeys: metadata?.airedEpisodeKeys,
      watchedEpisodeKeys: watchedKeys,
      legacyCompleted: isLegacyCompleted(media, watchedEpisodes.length),
    });

    const persistedState = normalizeTvTrackingState(media.status) ?? "not_started";
    const effectiveState = derived.verified ? derived.state : persistedState;
    const lastWatchedAt = watchedEpisodes[0]?.watchedAt ?? media.watchedAt;
    const update: Prisma.MediaUpdateInput = {};

    // A temporary TMDB failure must never rewrite a previously valid tracking
    // state. Metadata fields may still be refreshed when available, but state
    // transitions are persisted only after the aired-episode boundary is verified.
    if (derived.verified) {
      Object.assign(update, tvStateToMediaPatch(derived.state, lastWatchedAt));
    }

    if (metadata) {
      const classification = classificationFromMetadata(metadata);
      if (metadata.totalEpisodes != null) update.episodes = metadata.totalEpisodes;
      if (metadata.totalSeasons != null) update.seasons = metadata.totalSeasons;
      if (!media.poster && metadata.posterPath) update.poster = canonicalMediaPoster(metadata.posterPath);
      if (!media.overview && metadata.overview) update.overview = metadata.overview;
      if (media.genres.length === 0 && classification.genres.length > 0) update.genres = classification.genres;
      if (!media.originalLanguage && classification.originalLanguage) update.originalLanguage = classification.originalLanguage;
      if (media.originCountries.length === 0 && classification.originCountries.length > 0) update.originCountries = classification.originCountries;
      if (classification.isArabic && !media.isArabic) {
        update.isArabic = true;
        update.isAnime = false;
      } else if (classification.isAnime && !media.isAnime && !media.isArabic) {
        update.isAnime = true;
        update.isArabic = false;
      }
    }

    const updated = Object.keys(update).length > 0
      ? await db.media.update({ where: { id: media.id }, data: update })
      : media;

    return {
      newStatus: effectiveState,
      isEnded: metadata ? metadata.officiallyEnded : null,
      showTmdbId,
      mediaId: updated.id,
      needsRating: derived.verified && effectiveState === "finished" && updated.userRating == null,
      airedEpisodeCount: derived.airedEpisodeCount,
      watchedAiredEpisodeCount: derived.watchedAiredEpisodeCount,
      ignoredFutureEpisodeCount: derived.futureOrUnknownWatchedEpisodeCount,
      verified: derived.verified,
    };
  } catch (error) {
    console.error("[autoUpdateShowStatus]", error);
    return null;
  }
}

function parseRequestedEpisode(value: any): TvEpisodeRequest | null {
  const seasonNumber = Number(value?.seasonNumber);
  const episodeNumber = Number(value?.episodeNumber);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return null;
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  return {
    seasonNumber,
    episodeNumber,
    episodeName: typeof value?.episodeName === "string" ? value.episodeName : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");

    const numericShowId = showId ? Number(showId) : null;
    const validShowId = numericShowId && Number.isInteger(numericShowId) && numericShowId > 0
      ? numericShowId
      : null;

    const items = await db.watchedEpisode.findMany({
      where: {
        userId: user.id,
        ...(validShowId ? { showId: validShowId } : {}),
      },
      orderBy: { watchedAt: "desc" },
    });

    if (!validShowId) return NextResponse.json({ items });

    const media = await db.media.findUnique({
      where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: validShowId } },
    });
    if (!media) return NextResponse.json({ items });

    // GET stays read-only. For legacy whole-show completions, return a virtual
    // snapshot so every historically watched episode is visible immediately.
    const snapshot = await materializeLegacyCompletionSnapshot({
      media,
      existingEpisodeCount: items.length,
      persist: false,
    });
    if (snapshot.attempted && !snapshot.verified) {
      return NextResponse.json(
        { error: "Could not verify the legacy episode snapshot. Your saved completion was not changed." },
        { status: 503 },
      );
    }

    if (snapshot.episodes.length === 0) return NextResponse.json({ items });

    const existingKeys = new Set(items.map((item) => episodeKey(item.seasonNumber, item.episodeNumber)));
    const virtualItems = snapshot.episodes
      .filter((episode) => !existingKeys.has(episodeKey(episode.seasonNumber, episode.episodeNumber)))
      .map((episode) => ({
        id: `legacy:${validShowId}:${episode.seasonNumber}:${episode.episodeNumber}`,
        userId: user.id,
        showId: validShowId,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.episodeName,
        runtime: episode.runtime,
        watchedAt: snapshot.completionAt,
        _virtualLegacySnapshot: true,
      }));

    return NextResponse.json({ items: [...items, ...virtualItems] });
  } catch (error) {
    console.error("[watched-episodes:GET]", error);
    return NextResponse.json({ error: "Failed to load episodes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const showId = Number(body.showId);
    if (!Number.isInteger(showId) || showId <= 0) {
      return NextResponse.json({ error: "A valid showId is required" }, { status: 400 });
    }

    const requested = Array.isArray(body.episodes)
      ? body.episodes.map(parseRequestedEpisode).filter(Boolean) as TvEpisodeRequest[]
      : [parseRequestedEpisode(body)].filter(Boolean) as TvEpisodeRequest[];

    if (requested.length === 0) {
      return NextResponse.json(
        { error: "seasonNumber and episodeNumber are required" },
        { status: 400 },
      );
    }

    const validation = await validateReleasedEpisodeBatch(showId, requested);
    if (validation.blocked.length > 0) {
      return NextResponse.json(
        {
          error: "Future or unaired episodes cannot be marked as watched.",
          code: "EPISODE_NOT_RELEASED",
          blockedEpisodes: validation.blocked,
        },
        { status: 409 },
      );
    }

    const media = await ensureSeriesMedia(user.id, showId);
    const existingEpisodeCount = await db.watchedEpisode.count({ where: { userId: user.id, showId } });
    const legacySnapshot = await materializeLegacyCompletionSnapshot({
      media,
      existingEpisodeCount,
      persist: false,
    });
    if (legacySnapshot.attempted && !legacySnapshot.verified) {
      return NextResponse.json(
        { error: "Could not verify the legacy episode snapshot. No progress was changed." },
        { status: 503 },
      );
    }

    const requestedNames = new Map(
      requested.map((episode) => [
        episodeKey(episode.seasonNumber, episode.episodeNumber),
        episode.episodeName || null,
      ]),
    );

    await db.$transaction(async (tx) => {
      if (legacySnapshot.episodes.length > 0) {
        await tx.watchedEpisode.createMany({
          data: legacySnapshot.episodes.map((episode) => ({
            userId: user.id,
            showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: episode.episodeName,
            runtime: episode.runtime,
            watchedAt: legacySnapshot.completionAt ?? new Date(),
          })),
          skipDuplicates: true,
        });
      }

      for (const episode of validation.released) {
        await tx.watchedEpisode.upsert({
          where: {
            userId_showId_seasonNumber_episodeNumber: {
              userId: user.id,
              showId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
            },
          },
          create: {
            userId: user.id,
            showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: requestedNames.get(episodeKey(episode.seasonNumber, episode.episodeNumber))
              || episode.episodeName,
            runtime: episode.runtime,
          },
          update: {
            episodeName: requestedNames.get(episodeKey(episode.seasonNumber, episode.episodeNumber))
              || episode.episodeName,
            runtime: episode.runtime,
          },
        });
      }
    });

    const completion = await autoUpdateShowStatus(user.id, showId);
    return NextResponse.json({
      ok: true,
      count: validation.released.length,
      completion,
    });
  } catch (error) {
    console.error("[watched-episodes:POST]", error);
    return NextResponse.json({ error: "Failed to mark episode watched" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = Number(url.searchParams.get("showId"));
    const seasonNumber = Number(url.searchParams.get("seasonNumber"));
    const episodeNumber = Number(url.searchParams.get("episodeNumber"));

    if (!Number.isInteger(showId) || showId <= 0
      || !Number.isInteger(seasonNumber) || seasonNumber < 1
      || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      return NextResponse.json({ error: "showId, seasonNumber and episodeNumber are required" }, { status: 400 });
    }

    const [media, existingCount] = await Promise.all([
      db.media.findUnique({ where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: showId } } }),
      db.watchedEpisode.count({ where: { userId: user.id, showId } }),
    ]);

    // Older versions stored whole-show completion without individual episode rows.
    // Resolve the historic snapshot before entering the transaction, then persist
    // it and remove the selected episode atomically. A TMDB failure blocks the
    // mutation rather than silently turning a completed show into one watched row.
    const legacySnapshot = media && isLegacyCompleted(media, existingCount)
      ? await materializeLegacyCompletionSnapshot({ media, existingEpisodeCount: existingCount, persist: false })
      : null;

    if (legacySnapshot?.attempted && !legacySnapshot.verified) {
      return NextResponse.json(
        { error: "Could not verify the legacy episode snapshot. No progress was changed." },
        { status: 503 },
      );
    }

    await db.$transaction(async (tx) => {
      if (legacySnapshot?.episodes.length) {
        await tx.watchedEpisode.createMany({
          data: legacySnapshot.episodes.map((episode) => ({
            userId: user.id,
            showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: episode.episodeName,
            runtime: episode.runtime,
            watchedAt: legacySnapshot.completionAt ?? new Date(),
          })),
          skipDuplicates: true,
        });
      }

      await tx.watchedEpisode.deleteMany({
        where: { userId: user.id, showId, seasonNumber, episodeNumber },
      });
    });

    const completion = await autoUpdateShowStatus(user.id, showId);
    return NextResponse.json({ ok: true, completion });
  } catch (error) {
    console.error("[watched-episodes:DELETE]", error);
    return NextResponse.json({ error: "Failed to unmark episode" }, { status: 500 });
  }
}
