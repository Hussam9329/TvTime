import { db } from "@/lib/db";
import { normalizeTvTrackingState } from "@/lib/tv-status-engine";
import {
  getAllReleasedEpisodes,
  getTvStatusMetadata,
  type ReleasedEpisode,
  type TvStatusMetadata,
} from "@/lib/tv-status-server";

type LegacyCompletionMedia = {
  id: string;
  userId: string;
  tmdbId: number | null;
  status: string | null;
  watched: boolean;
  watchedAt: Date | string | null;
  addedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type LegacyCompletionMaterialization = {
  attempted: boolean;
  materialized: boolean;
  completionAt: Date | null;
  episodes: ReleasedEpisode[];
};

function validDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isLegacyWholeShowCompletion(media: LegacyCompletionMedia, existingEpisodeCount: number): boolean {
  if (existingEpisodeCount > 0 || !media.tmdbId) return false;
  const state = normalizeTvTrackingState(media.status);
  return Boolean(media.watched || state === "finished" || state === "uptodate");
}

/**
 * Older builds could store a completed/caught-up series only on Media, without
 * one WatchedEpisode row per episode. Snapshot the episodes that had actually
 * aired at the historical completion time exactly once. After that, a newly
 * aired episode is absent from the snapshot and correctly moves an ongoing show
 * from Up To Date to Watching. This operation is additive and idempotent.
 *
 * TVM-27: The `persist` parameter controls whether the snapshot is written to
 * the database. When called from a GET handler, pass persist=false to avoid
 * writes during reads. The episodes are still returned for in-memory state
 * derivation. A separate sync endpoint can call with persist=true.
 */
export async function materializeLegacyCompletionSnapshot(args: {
  media: LegacyCompletionMedia;
  existingEpisodeCount?: number;
  metadata?: TvStatusMetadata | null;
  persist?: boolean; // TVM-27: default false (read-only during GET)
}): Promise<LegacyCompletionMaterialization> {
  const persist = args.persist ?? false; // TVM-27: default to no-write
  const existingEpisodeCount = args.existingEpisodeCount ?? await db.watchedEpisode.count({
    where: { userId: args.media.userId, showId: Number(args.media.tmdbId || 0) },
  });

  if (!isLegacyWholeShowCompletion(args.media, existingEpisodeCount)) {
    return { attempted: false, materialized: false, completionAt: null, episodes: [] };
  }

  const completionAt = validDate(args.media.watchedAt)
    ?? validDate(args.media.updatedAt)
    ?? validDate(args.media.addedAt)
    ?? new Date();

  try {
    const metadata = args.metadata ?? await getTvStatusMetadata(Number(args.media.tmdbId));
    const releasedAtCompletion = await getAllReleasedEpisodes(
      Number(args.media.tmdbId),
      completionAt,
      metadata,
    );

    if (releasedAtCompletion.length === 0) {
      return { attempted: true, materialized: false, completionAt, episodes: [] };
    }

    // TVM-27: Only persist when explicitly requested (not during GET)
    if (persist) {
      await db.watchedEpisode.createMany({
        data: releasedAtCompletion.map((episode) => ({
          userId: args.media.userId,
          showId: Number(args.media.tmdbId),
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeName: episode.episodeName,
          runtime: episode.runtime,
          watchedAt: completionAt,
        })),
        skipDuplicates: true,
      });
    }

    return {
      attempted: true,
      materialized: persist, // only true if we actually wrote
      completionAt,
      episodes: releasedAtCompletion,
    };
  } catch (error) {
    console.warn("[tv-status-repair] Legacy completion snapshot was not materialized", {
      mediaId: args.media.id,
      tmdbId: args.media.tmdbId,
      error,
    });
    return { attempted: true, materialized: false, completionAt, episodes: [] };
  }
}
