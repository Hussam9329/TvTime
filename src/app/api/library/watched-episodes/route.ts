import { NextRequest, NextResponse } from "next/server";
import type { Media, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
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
  type TvStatusMetadata,
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

type DbTransaction = Prisma.TransactionClient;

function classificationFromMetadata(metadata: TvStatusMetadata) {
  const originalLanguage = metadata.originalLanguage?.trim().toLowerCase() || null;
  const originCountries = normalizeCountryCodes(metadata.originCountries);
  const genres = metadata.genres.map((genre) => genre.name).filter(Boolean);
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

async function ensureSeriesMedia(
  tx: DbTransaction,
  userId: string,
  showTmdbId: number,
  metadata: TvStatusMetadata,
): Promise<Media> {
  const identity = { userId, type: "series", tmdbId: showTmdbId };
  const classification = classificationFromMetadata(metadata);

  return tx.media.upsert({
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

async function lockSeriesMedia(tx: DbTransaction, mediaId: string): Promise<Media> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Media"
    WHERE "id" = ${mediaId}
    FOR UPDATE
  `;

  const media = await tx.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error("Series media disappeared while updating episode progress");
  return media;
}

/**
 * Derive and persist the show state using the episode rows visible inside the
 * same transaction as the mutation. TMDB/network work is completed before the
 * transaction starts; this helper performs database reads and writes only.
 */
async function updateShowStatusInTransaction(
  tx: DbTransaction,
  media: Media,
  userId: string,
  showTmdbId: number,
  metadata: TvStatusMetadata,
): Promise<CompletionInfo> {
  const watchedEpisodes = await tx.watchedEpisode.findMany({
    where: { userId, showId: showTmdbId },
    select: { seasonNumber: true, episodeNumber: true, watchedAt: true },
    orderBy: { watchedAt: "desc" },
  });
  const watchedKeys = watchedEpisodes.map((episode) =>
    episodeKey(episode.seasonNumber, episode.episodeNumber),
  );
  const derived = deriveTvTrackingState({
    persistedStatus: media.status,
    officiallyEnded: metadata.officiallyEnded,
    airedEpisodeCount: metadata.airedEpisodeCount,
    airedEpisodeKeys: metadata.airedEpisodeKeys,
    watchedEpisodeKeys: watchedKeys,
    legacyCompleted: isLegacyCompleted(media, watchedEpisodes.length),
  });

  const persistedState = normalizeTvTrackingState(media.status);
  const safeUnverifiedState: TvTrackingState = watchedEpisodes.length > 0
    ? "watching"
    : persistedState === "planned"
      ? "planned"
      : "not_started";
  const effectiveState = derived.verified ? derived.state : safeUnverifiedState;
  const lastWatchedAt = watchedEpisodes[0]?.watchedAt ?? null;
  const classification = classificationFromMetadata(metadata);
  const update: Prisma.MediaUpdateInput = {
    ...tvStateToMediaPatch(effectiveState, lastWatchedAt),
    episodes: metadata.totalEpisodes,
    seasons: metadata.totalSeasons,
    genres: classification.genres,
    originalLanguage: classification.originalLanguage,
    originCountries: classification.originCountries,
    isArabic: classification.isArabic,
    isAnime: classification.isAnime,
  };

  if (!media.poster && metadata.posterPath) {
    update.poster = canonicalMediaPoster(metadata.posterPath);
  }
  if (!media.overview && metadata.overview) update.overview = metadata.overview;
  if (!media.year && metadata.firstAirDate) update.year = metadata.firstAirDate.slice(0, 4);

  const updated = await tx.media.update({ where: { id: media.id }, data: update });
  return {
    newStatus: effectiveState,
    isEnded: metadata.officiallyEnded,
    showTmdbId,
    mediaId: updated.id,
    needsRating: derived.verified && effectiveState === "finished" && updated.userRating == null,
    airedEpisodeCount: derived.airedEpisodeCount,
    watchedAiredEpisodeCount: derived.watchedAiredEpisodeCount,
    ignoredFutureEpisodeCount: derived.futureOrUnknownWatchedEpisodeCount,
    verified: derived.verified,
  };
}

function parseRequestedEpisode(value: unknown): TvEpisodeRequest | null {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const seasonNumber = Number(item.seasonNumber);
  const episodeNumber = Number(item.episodeNumber);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return null;
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  return {
    seasonNumber,
    episodeNumber,
    episodeName: typeof item.episodeName === "string" ? item.episodeName : null,
  };
}

async function loadMutationMetadata(showId: number, now: Date): Promise<TvStatusMetadata | null> {
  try {
    return await getTvStatusMetadata(showId, now, { requireClassification: true });
  } catch (error) {
    console.warn("[watched-episodes] Unable to verify TV metadata", showId, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
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
    const user = await getOrCreateUser(await resolveUserId(req));
    const body: unknown = await req.json();
    const objectBody = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const showId = Number(objectBody.showId);
    if (!Number.isInteger(showId) || showId <= 0) {
      return NextResponse.json({ error: "A valid showId is required" }, { status: 400 });
    }

    const requested = Array.isArray(objectBody.episodes)
      ? objectBody.episodes.map(parseRequestedEpisode).filter((item): item is TvEpisodeRequest => item !== null)
      : [parseRequestedEpisode(objectBody)].filter((item): item is TvEpisodeRequest => item !== null);

    if (requested.length === 0) {
      return NextResponse.json(
        { error: "seasonNumber and episodeNumber are required" },
        { status: 400 },
      );
    }

    const now = new Date();
    const metadata = await loadMutationMetadata(showId, now);
    if (!metadata) {
      return NextResponse.json(
        { error: "Could not verify the TV metadata. No progress was changed." },
        { status: 503 },
      );
    }

    const validation = await validateReleasedEpisodeBatch(showId, requested, now, metadata);
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

    const [existingMedia, existingEpisodeCount] = await Promise.all([
      db.media.findUnique({
        where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: showId } },
      }),
      db.watchedEpisode.count({ where: { userId: user.id, showId } }),
    ]);
    const legacySnapshot = existingMedia
      ? await materializeLegacyCompletionSnapshot({
          media: existingMedia,
          existingEpisodeCount,
          metadata,
          persist: false,
        })
      : null;
    if (legacySnapshot?.attempted && !legacySnapshot.verified) {
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

    const completion = await db.$transaction(async (tx) => {
      const ensuredMedia = await ensureSeriesMedia(tx, user.id, showId, metadata);
      const lockedMedia = await lockSeriesMedia(tx, ensuredMedia.id);

      if (legacySnapshot?.episodes.length) {
        await tx.watchedEpisode.createMany({
          data: legacySnapshot.episodes.map((episode) => ({
            userId: user.id,
            showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: episode.episodeName,
            runtime: episode.runtime,
            watchedAt: legacySnapshot.completionAt ?? now,
          })),
          skipDuplicates: true,
        });
      }

      for (const episode of validation.released) {
        const key = episodeKey(episode.seasonNumber, episode.episodeNumber);
        const episodeName = requestedNames.get(key) || episode.episodeName;
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
            episodeName,
            runtime: episode.runtime,
          },
          update: { episodeName, runtime: episode.runtime },
        });
      }

      return updateShowStatusInTransaction(tx, lockedMedia, user.id, showId, metadata);
    }, { timeout: 30_000 });

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
    const user = await getOrCreateUser(await resolveUserId(req));
    const url = new URL(req.url);
    const showId = Number(url.searchParams.get("showId"));
    const seasonNumber = Number(url.searchParams.get("seasonNumber"));
    const episodeNumber = Number(url.searchParams.get("episodeNumber"));

    if (!Number.isInteger(showId) || showId <= 0
      || !Number.isInteger(seasonNumber) || seasonNumber < 1
      || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      return NextResponse.json(
        { error: "showId, seasonNumber and episodeNumber are required" },
        { status: 400 },
      );
    }

    const now = new Date();
    const metadata = await loadMutationMetadata(showId, now);
    if (!metadata) {
      return NextResponse.json(
        { error: "Could not verify the TV metadata. No progress was changed." },
        { status: 503 },
      );
    }

    const [existingMedia, existingCount] = await Promise.all([
      db.media.findUnique({
        where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: showId } },
      }),
      db.watchedEpisode.count({ where: { userId: user.id, showId } }),
    ]);

    if (!existingMedia && existingCount === 0) {
      return NextResponse.json({ ok: true, completion: null });
    }

    // Older versions stored whole-show completion without individual episode rows.
    // Resolve that snapshot before opening the transaction, then materialize it,
    // delete the selected row and update Media under one row lock.
    const legacySnapshot = existingMedia && isLegacyCompleted(existingMedia, existingCount)
      ? await materializeLegacyCompletionSnapshot({
          media: existingMedia,
          existingEpisodeCount: existingCount,
          metadata,
          persist: false,
        })
      : null;

    if (legacySnapshot?.attempted && !legacySnapshot.verified) {
      return NextResponse.json(
        { error: "Could not verify the legacy episode snapshot. No progress was changed." },
        { status: 503 },
      );
    }

    const completion = await db.$transaction(async (tx) => {
      const ensuredMedia = await ensureSeriesMedia(tx, user.id, showId, metadata);
      const lockedMedia = await lockSeriesMedia(tx, ensuredMedia.id);

      if (legacySnapshot?.episodes.length) {
        await tx.watchedEpisode.createMany({
          data: legacySnapshot.episodes.map((episode) => ({
            userId: user.id,
            showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: episode.episodeName,
            runtime: episode.runtime,
            watchedAt: legacySnapshot.completionAt ?? now,
          })),
          skipDuplicates: true,
        });
      }

      await tx.watchedEpisode.deleteMany({
        where: { userId: user.id, showId, seasonNumber, episodeNumber },
      });

      return updateShowStatusInTransaction(tx, lockedMedia, user.id, showId, metadata);
    }, { timeout: 30_000 });

    return NextResponse.json({ ok: true, completion });
  } catch (error) {
    console.error("[watched-episodes:DELETE]", error);
    return NextResponse.json({ error: "Failed to unmark episode" }, { status: 500 });
  }
}
