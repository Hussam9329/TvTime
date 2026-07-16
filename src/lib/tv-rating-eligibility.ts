import { db } from "@/lib/db";
import { episodeKey } from "@/lib/tv-status-engine";
import { getTvStatusMetadata } from "@/lib/tv-status-server";
import { isWholeSeriesRatingEligible } from "@/lib/tv-rating-rules";

export type TvRatingEligibility = {
  allowed: boolean;
  reason: "ok" | "missing-tmdb-id" | "show-not-ended" | "not-fully-watched" | "tmdb-unverified";
  totalEpisodes: number;
  watchedEpisodes: number;
  tmdbStatus: string | null;
};

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
    if (!metadata.officiallyEnded) {
      return {
        allowed: false,
        reason: "show-not-ended",
        totalEpisodes: metadata.airedEpisodeCount ?? 0,
        watchedEpisodes: 0,
        tmdbStatus: metadata.tmdbStatus,
      };
    }

    const watchedRows = await db.watchedEpisode.findMany({
      where: { userId, showId: Number(tmdbId) },
      select: { seasonNumber: true, episodeNumber: true },
    });
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
