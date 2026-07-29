import type { Media, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { episodeKey } from "@/lib/tv-status-engine";
import { getTvStatusMetadata } from "@/lib/tv-status-server";
import { isWholeSeriesRatingEligible } from "@/lib/tv-rating-rules";
import { materializeLegacyCompletionSnapshot } from "@/lib/tv-status-repair";

export type TvRatingEligibility = {
  allowed: boolean;
  reason: "ok" | "missing-tmdb-id" | "show-not-ended" | "not-fully-watched" | "tmdb-unverified";
  totalEpisodes: number;
  watchedEpisodes: number;
  tmdbStatus: string | null;
};

export function evaluateTvRatingEligibility(
  metadata: Awaited<ReturnType<typeof getTvStatusMetadata>>,
  watchedRows: Array<{ seasonNumber: number; episodeNumber: number }>,
): TvRatingEligibility {
  if (!metadata.officiallyEnded) {
    return {
      allowed: false,
      reason: "show-not-ended",
      totalEpisodes: metadata.airedEpisodeCount ?? 0,
      watchedEpisodes: 0,
      tmdbStatus: metadata.tmdbStatus,
    };
  }

  const watchedKeys = new Set(
    watchedRows.map((row) => episodeKey(row.seasonNumber, row.episodeNumber)),
  );
  const watchedAired = metadata.airedEpisodeKeys.size > 0
    ? [...metadata.airedEpisodeKeys].filter((key) => watchedKeys.has(key)).length
    : Math.min(watchedKeys.size, metadata.airedEpisodeCount ?? 0);
  const totalAired = metadata.airedEpisodeCount ?? 0;

  if (!isWholeSeriesRatingEligible({
    officiallyEnded: metadata.officiallyEnded,
    totalEpisodes: totalAired,
    watchedEpisodes: watchedAired,
  })) {
    return {
      allowed: false,
      reason: "not-fully-watched",
      totalEpisodes: totalAired,
      watchedEpisodes: watchedAired,
      tmdbStatus: metadata.tmdbStatus,
    };
  }

  return {
    allowed: true,
    reason: "ok",
    totalEpisodes: totalAired,
    watchedEpisodes: watchedAired,
    tmdbStatus: metadata.tmdbStatus,
  };
}

export async function getTvRatingEligibility(
  userId: string,
  tmdbId: number | null | undefined,
): Promise<TvRatingEligibility> {
  if (!tmdbId) {
    return {
      allowed: false,
      reason: "missing-tmdb-id",
      totalEpisodes: 0,
      watchedEpisodes: 0,
      tmdbStatus: null,
    };
  }

  try {
    const metadata = await getTvStatusMetadata(Number(tmdbId));

    const [storedWatchedRows, media] = await Promise.all([
      db.watchedEpisode.findMany({
        where: { userId, showId: Number(tmdbId) },
        select: { seasonNumber: true, episodeNumber: true },
      }),
      db.media.findUnique({
        where: { userId_type_tmdbId: { userId, type: "series", tmdbId: Number(tmdbId) } },
      }),
    ]);
    let watchedRows = storedWatchedRows;
    if (watchedRows.length === 0 && media) {
      const snapshot = await materializeLegacyCompletionSnapshot({
        media,
        existingEpisodeCount: 0,
        metadata,
        persist: true,
      });
      if (snapshot.attempted && !snapshot.verified) {
        return {
          allowed: false,
          reason: "tmdb-unverified",
          totalEpisodes: metadata.airedEpisodeCount ?? 0,
          watchedEpisodes: 0,
          tmdbStatus: metadata.tmdbStatus,
        };
      }
      if (snapshot.episodes.length > 0) {
        watchedRows = snapshot.episodes.map((episode) => ({
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
        }));
      }
    }
    return evaluateTvRatingEligibility(metadata, watchedRows);
  } catch (error) {
    console.warn("[tv-rating-eligibility] Unable to verify TV rating eligibility", tmdbId, error);
    return {
      allowed: false,
      reason: "tmdb-unverified",
      totalEpisodes: 0,
      watchedEpisodes: 0,
      tmdbStatus: null,
    };
  }
}

export async function saveTvCompletionRating(args: {
  userId: string;
  mediaId: string;
  rating: number;
}): Promise<{ item: Media | null; eligibility: TvRatingEligibility }> {
  const media = await db.media.findFirst({
    where: { id: args.mediaId, userId: args.userId, type: "series" },
  });
  if (!media?.tmdbId) {
    return {
      item: null,
      eligibility: {
        allowed: false,
        reason: "missing-tmdb-id",
        totalEpisodes: 0,
        watchedEpisodes: 0,
        tmdbStatus: null,
      },
    };
  }

  // This preflight also materializes a verified legacy completion snapshot
  // during this explicit write request when needed.
  const preflight = await getTvRatingEligibility(args.userId, media.tmdbId);
  if (!preflight.allowed) return { item: null, eligibility: preflight };

  let metadata: Awaited<ReturnType<typeof getTvStatusMetadata>>;
  try {
    metadata = await getTvStatusMetadata(media.tmdbId);
  } catch {
    return {
      item: null,
      eligibility: {
        allowed: false,
        reason: "tmdb-unverified",
        totalEpisodes: 0,
        watchedEpisodes: 0,
        tmdbStatus: null,
      },
    };
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Media"
      WHERE "id" = ${media.id}
        AND "userId" = ${args.userId}
        AND "type" = 'series'
      FOR UPDATE
    `;
    const lockedMedia = await tx.media.findFirst({
      where: { id: media.id, userId: args.userId, type: "series" },
    });
    if (!lockedMedia?.tmdbId) {
      return {
        item: null,
        eligibility: {
          allowed: false,
          reason: "missing-tmdb-id" as const,
          totalEpisodes: 0,
          watchedEpisodes: 0,
          tmdbStatus: null,
        },
      };
    }
    // Metadata was fetched for the identity read before the lock. A media row
    // should never change its TMDB identity, but fail closed if a concurrent
    // compatibility write does so instead of evaluating the wrong show.
    if (lockedMedia.tmdbId !== media.tmdbId) {
      return {
        item: null,
        eligibility: {
          allowed: false,
          reason: "tmdb-unverified" as const,
          totalEpisodes: 0,
          watchedEpisodes: 0,
          tmdbStatus: null,
        },
      };
    }

    const watchedRows = await tx.watchedEpisode.findMany({
      where: { userId: args.userId, showId: lockedMedia.tmdbId },
      select: { seasonNumber: true, episodeNumber: true, watchedAt: true },
      orderBy: { watchedAt: "desc" },
    });
    const eligibility = evaluateTvRatingEligibility(metadata, watchedRows);
    if (!eligibility.allowed) return { item: null, eligibility };

    const item = await tx.media.update({
      where: { id: lockedMedia.id },
      data: {
        userRating: args.rating,
        status: "finished",
        watched: true,
        watchedAt: watchedRows[0]?.watchedAt ?? lockedMedia.watchedAt ?? new Date(),
        ratingStatus: null,
      },
    });
    return { item, eligibility };
  }, { timeout: 30_000 });
}

export function tvRatingEligibilityError(eligibility: TvRatingEligibility) {
  if (eligibility.reason === "not-fully-watched") {
    return {
      code: "TV_RATING_REQUIRES_ALL_FINAL_EPISODES",
      message: "TV series can only be rated after every final episode has been watched.",
    };
  }
  if (eligibility.reason === "show-not-ended") {
    return {
      code: "TV_RATING_LOCKED_UNTIL_ENDED",
      message: "TV series can only be rated after the whole show has officially ended.",
    };
  }
  return {
    code: "TV_RATING_ELIGIBILITY_UNVERIFIED",
    message: "TV series rating eligibility could not be verified right now.",
  };
}
