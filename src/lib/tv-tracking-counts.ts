import { isFutureEpisode, normalizeTvTrackingState, type TvTrackingState } from "@/lib/tv-status-engine";

export type TvTrackingCounts = {
  all: number;
  planned: number;
  watchlist: number;
  notStarted: number;
  haventStarted: number;
  watching: number;
  uptodate: number;
  finished: number;
  upcoming: number;
  haventWatched: number;
  stale?: number;
};

export type FastTvTrackingRow = {
  tmdbId: number | null;
  status: string | null;
  watched: boolean;
  episodeCount: number;
  lastWatchedAt: Date | null;
  officiallyEnded: boolean | null;
  airedEpisodeCount: number | null;
  nextEpisodeAirDate: string | null;
  metadataFresh: boolean;
};

export type FastTvTrackingSummary = {
  counts: TvTrackingCounts;
  freshMetadataRows: number;
  unverifiedProgressRows: number;
};

function safeCount(value: number): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/**
 * Derive a lightweight state from persisted Media state, one aggregate episode
 * count and fresh compact metadata. This deliberately does not fetch TMDB or
 * deserialize episode-key arrays. Episode mutations persist the authoritative
 * state atomically, while the numeric cache boundary lets the fast path repair
 * obvious stale labels without an N+1 request fan-out.
 */
export function deriveFastTvTrackingState(row: FastTvTrackingRow): {
  state: TvTrackingState;
  hasUnwatchedReleasedEpisode: boolean;
  verified: boolean;
} {
  const persisted = normalizeTvTrackingState(row.status);
  const episodeCount = safeCount(row.episodeCount);
  const airedEpisodeCount = row.metadataFresh && row.airedEpisodeCount != null
    ? safeCount(row.airedEpisodeCount)
    : null;

  if (episodeCount > 0) {
    if (airedEpisodeCount != null && airedEpisodeCount > 0) {
      if (episodeCount >= airedEpisodeCount) {
        return {
          state: row.officiallyEnded === true ? "finished" : "uptodate",
          hasUnwatchedReleasedEpisode: false,
          verified: true,
        };
      }
      return { state: "watching", hasUnwatchedReleasedEpisode: true, verified: true };
    }

    const fallbackState = persisted === "finished" || persisted === "uptodate"
      ? persisted
      : "watching";
    return {
      state: fallbackState,
      hasUnwatchedReleasedEpisode: fallbackState === "watching",
      verified: false,
    };
  }

  if (persisted === "planned") {
    return { state: "planned", hasUnwatchedReleasedEpisode: false, verified: true };
  }
  if (persisted === "finished" || persisted === "uptodate") {
    return { state: persisted, hasUnwatchedReleasedEpisode: false, verified: false };
  }
  if (row.watched) {
    return { state: "finished", hasUnwatchedReleasedEpisode: false, verified: false };
  }
  return { state: "not_started", hasUnwatchedReleasedEpisode: false, verified: true };
}

export function buildFastTvTrackingSummary(
  rows: FastTvTrackingRow[],
  now: Date = new Date(),
): FastTvTrackingSummary {
  const counts: TvTrackingCounts = {
    all: rows.length,
    planned: 0,
    watchlist: 0,
    notStarted: 0,
    haventStarted: 0,
    watching: 0,
    uptodate: 0,
    finished: 0,
    upcoming: 0,
    haventWatched: 0,
  };

  let freshMetadataRows = 0;
  let unverifiedProgressRows = 0;

  for (const row of rows) {
    const derived = deriveFastTvTrackingState(row);
    if (row.metadataFresh) freshMetadataRows += 1;
    if (!derived.verified && safeCount(row.episodeCount) > 0) unverifiedProgressRows += 1;

    if (derived.state === "planned") {
      counts.planned += 1;
      counts.watchlist += 1;
    } else if (derived.state === "not_started") {
      counts.notStarted += 1;
      counts.haventStarted += 1;
    } else if (derived.state === "watching") {
      counts.watching += 1;
    } else if (derived.state === "uptodate") {
      counts.uptodate += 1;
    } else if (derived.state === "finished") {
      counts.finished += 1;
    }

    if (derived.hasUnwatchedReleasedEpisode) counts.haventWatched += 1;
    if (row.metadataFresh && row.nextEpisodeAirDate && isFutureEpisode(row.nextEpisodeAirDate, now)) {
      counts.upcoming += 1;
    }
  }

  return { counts, freshMetadataRows, unverifiedProgressRows };
}
