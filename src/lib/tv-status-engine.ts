export type TvTrackingState = "planned" | "not_started" | "watching" | "uptodate" | "finished";

export type TvEpisodeIdentity = {
  seasonNumber: number;
  episodeNumber: number;
};

export type TvEpisodeLike = {
  season_number: number;
  episode_number: number;
  air_date?: string | null;
};

export type TvSeasonLike = {
  season_number: number;
  episode_count?: number | null;
  air_date?: string | null;
};

export type TvEpisodeBoundaryLike = {
  season_number?: number | null;
  episode_number?: number | null;
  air_date?: string | null;
  name?: string | null;
};

export type TvDetailStatusLike = {
  status?: string | null;
  in_production?: boolean | null;
  number_of_episodes?: number | null;
  number_of_seasons?: number | null;
  seasons?: TvSeasonLike[] | null;
  last_episode_to_air?: TvEpisodeBoundaryLike | null;
  next_episode_to_air?: TvEpisodeBoundaryLike | null;
};

export type InferredAiredEpisodes = {
  airedEpisodeCount: number | null;
  airedEpisodeKeys: Set<string>;
  reliable: boolean;
  source: "last_episode_to_air" | "next_episode_to_air" | "ended_total" | "unavailable";
};

export type DeriveTvTrackingStateInput = {
  persistedStatus?: string | null;
  officiallyEnded: boolean | null;
  airedEpisodeCount: number | null;
  watchedEpisodeKeys?: Iterable<string>;
  airedEpisodeKeys?: Iterable<string>;
  legacyCompleted?: boolean;
};

export type DerivedTvTrackingState = {
  state: TvTrackingState;
  watchedAiredEpisodeCount: number;
  airedEpisodeCount: number | null;
  futureOrUnknownWatchedEpisodeCount: number;
  legacyCompletionAssumed: boolean;
  verified: boolean;
};

export function normalizeTvTrackingState(status?: string | null): TvTrackingState | null {
  const normalized = String(status || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  if (!normalized) return null;
  if (normalized === "planned" || normalized === "watchlist") return "planned";
  if (normalized === "not_started" || normalized === "havent_started" || normalized === "haven't_started") return "not_started";
  if (normalized === "watching" || normalized === "in_progress") return "watching";
  if (normalized === "uptodate" || normalized === "up_to_date") return "uptodate";
  if (normalized === "finished" || normalized === "completed") return "finished";
  if (normalized === "watched") return "finished"; // legacy completed marker; official status still decides final state.
  return null;
}

export function isOfficiallyEndedTvStatus(status?: string | null): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "ended" || normalized === "canceled" || normalized === "cancelled";
}

export function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${Number(seasonNumber)}-${Number(episodeNumber)}`;
}

function dateOnlyUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function isEpisodeReleased(airDate?: string | null, now: Date = new Date()): boolean {
  if (!airDate) return false;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(airDate)
    ? Date.parse(`${airDate}T00:00:00.000Z`)
    : Date.parse(airDate);
  if (Number.isNaN(parsed)) return false;
  return parsed <= dateOnlyUtc(now);
}

export function isFutureEpisode(airDate?: string | null, now: Date = new Date()): boolean {
  if (!airDate) return false;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(airDate)
    ? Date.parse(`${airDate}T00:00:00.000Z`)
    : Date.parse(airDate);
  if (Number.isNaN(parsed)) return false;
  return parsed > dateOnlyUtc(now);
}

export function filterReleasedEpisodes<T extends TvEpisodeLike>(episodes: T[], now: Date = new Date()): T[] {
  return episodes.filter((episode) => episode.season_number >= 1 && isEpisodeReleased(episode.air_date, now));
}

export function filterFutureEpisodes<T extends TvEpisodeLike>(episodes: T[], now: Date = new Date()): T[] {
  return episodes.filter((episode) => episode.season_number >= 1 && isFutureEpisode(episode.air_date, now));
}

function addEpisodeRange(keys: Set<string>, seasonNumber: number, episodeCount: number) {
  const safeCount = Math.max(0, Math.floor(Number(episodeCount) || 0));
  for (let episodeNumber = 1; episodeNumber <= safeCount; episodeNumber++) {
    keys.add(episodeKey(seasonNumber, episodeNumber));
  }
}

/**
 * Infers the released regular-episode set from a single TMDB TV-detail payload.
 * It deliberately stops at last_episode_to_air (or immediately before
 * next_episode_to_air), so future scheduled episodes never enter completion.
 */
export function inferAiredEpisodesFromTvDetail(
  detail: TvDetailStatusLike,
  now: Date = new Date(),
): InferredAiredEpisodes {
  const regularSeasons = [...(detail.seasons || [])]
    .filter((season) => Number(season.season_number) >= 1)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number));
  const keys = new Set<string>();

  const next = detail.next_episode_to_air;
  const nextSeason = Number(next?.season_number || 0);
  const nextEpisode = Number(next?.episode_number || 0);
  const nextIsDueOrReleased = Boolean(
    nextSeason > 0
      && nextEpisode > 0
      && next?.air_date
      && isEpisodeReleased(next.air_date, now),
  );

  // TMDB can keep an episode in next_episode_to_air until later on its air
  // date. Since TMDB exposes a date (not an exact local broadcast time), that
  // episode is considered released for daily progress as soon as the date is
  // reached. This prevents a same-day episode from being omitted.
  if (nextIsDueOrReleased) {
    for (const season of regularSeasons) {
      const seasonNumber = Number(season.season_number);
      if (seasonNumber < nextSeason) addEpisodeRange(keys, seasonNumber, Number(season.episode_count || 0));
      if (seasonNumber === nextSeason) addEpisodeRange(keys, seasonNumber, nextEpisode);
    }
    if (regularSeasons.length === 0) addEpisodeRange(keys, nextSeason, nextEpisode);
    return {
      airedEpisodeCount: keys.size,
      airedEpisodeKeys: keys,
      reliable: true,
      source: "next_episode_to_air",
    };
  }

  const last = detail.last_episode_to_air;
  const lastSeason = Number(last?.season_number || 0);
  const lastEpisode = Number(last?.episode_number || 0);
  const lastIsReleased = Boolean(lastSeason > 0 && lastEpisode > 0 && (!last?.air_date || isEpisodeReleased(last.air_date, now)));

  if (lastIsReleased) {
    for (const season of regularSeasons) {
      const seasonNumber = Number(season.season_number);
      if (seasonNumber < lastSeason) addEpisodeRange(keys, seasonNumber, Number(season.episode_count || 0));
      if (seasonNumber === lastSeason) addEpisodeRange(keys, seasonNumber, lastEpisode);
    }
    if (regularSeasons.length === 0) addEpisodeRange(keys, lastSeason, lastEpisode);
    return {
      airedEpisodeCount: keys.size,
      airedEpisodeKeys: keys,
      reliable: true,
      source: "last_episode_to_air",
    };
  }

  const nextIsFuture = Boolean(nextSeason > 0 && nextEpisode > 0 && isFutureEpisode(next?.air_date, now));

  if (nextIsFuture) {
    for (const season of regularSeasons) {
      const seasonNumber = Number(season.season_number);
      if (seasonNumber < nextSeason) addEpisodeRange(keys, seasonNumber, Number(season.episode_count || 0));
      if (seasonNumber === nextSeason) addEpisodeRange(keys, seasonNumber, Math.max(0, nextEpisode - 1));
    }
    return {
      airedEpisodeCount: keys.size,
      airedEpisodeKeys: keys,
      reliable: true,
      source: "next_episode_to_air",
    };
  }

  if (isOfficiallyEndedTvStatus(detail.status)) {
    for (const season of regularSeasons) {
      addEpisodeRange(keys, Number(season.season_number), Number(season.episode_count || 0));
    }
    const fallbackTotal = Math.max(0, Number(detail.number_of_episodes || 0));
    return {
      airedEpisodeCount: keys.size > 0 ? keys.size : (fallbackTotal > 0 ? fallbackTotal : null),
      airedEpisodeKeys: keys,
      reliable: keys.size > 0 || fallbackTotal > 0,
      source: "ended_total",
    };
  }

  return {
    airedEpisodeCount: null,
    airedEpisodeKeys: keys,
    reliable: false,
    source: "unavailable",
  };
}

function uniqueRegularEpisodeKeys(keys?: Iterable<string>): Set<string> {
  const result = new Set<string>();
  if (!keys) return result;
  for (const key of keys) {
    const match = /^(\d+)-(\d+)$/.exec(String(key));
    if (!match) continue;
    if (Number(match[1]) < 1 || Number(match[2]) < 1) continue;
    result.add(`${Number(match[1])}-${Number(match[2])}`);
  }
  return result;
}

/**
 * Single source of truth for TV tracking state.
 * Ratings are intentionally absent from the input: a rating can never affect
 * Planned / Not Started / Watching / Up To Date / Finished.
 */
export function deriveTvTrackingState(input: DeriveTvTrackingStateInput): DerivedTvTrackingState {
  const persisted = normalizeTvTrackingState(input.persistedStatus);
  const watchedKeys = uniqueRegularEpisodeKeys(input.watchedEpisodeKeys);
  const airedKeys = uniqueRegularEpisodeKeys(input.airedEpisodeKeys);
  const airedEpisodeCount = input.airedEpisodeCount == null
    ? null
    : Math.max(0, Number(input.airedEpisodeCount));

  let watchedAiredEpisodeCount = 0;
  let futureOrUnknownWatchedEpisodeCount = watchedKeys.size;

  if (airedKeys.size > 0) {
    for (const key of watchedKeys) {
      if (airedKeys.has(key)) watchedAiredEpisodeCount++;
    }
    futureOrUnknownWatchedEpisodeCount = Math.max(0, watchedKeys.size - watchedAiredEpisodeCount);
  } else if (airedEpisodeCount != null && input.officiallyEnded === true) {
    watchedAiredEpisodeCount = Math.min(watchedKeys.size, airedEpisodeCount);
    futureOrUnknownWatchedEpisodeCount = Math.max(0, watchedKeys.size - watchedAiredEpisodeCount);
  }

  const legacyCompletionAssumed = Boolean(
    input.legacyCompleted
      && watchedKeys.size === 0
      && airedEpisodeCount != null
      && airedEpisodeCount > 0,
  );

  // A legacy whole-show flag is informational only. It can trigger the
  // separate snapshot materializer, but it must never by itself prove that all
  // episodes were watched or produce Finished.
  //
  // For an ongoing show, a numeric aired count is not enough to prove which
  // watched episode keys belong inside that boundary. Cache readers must either
  // provide the exact aired keys for shows with progress, or accept an
  // unverified Watching state. Ended shows can safely use the numeric total as
  // a fallback because every regular episode belongs to the final boundary.
  const boundaryKnown = input.officiallyEnded != null && airedEpisodeCount != null;
  const progressIntersectionKnown = watchedKeys.size === 0
    || airedKeys.size > 0
    || input.officiallyEnded === true;
  const verified = boundaryKnown && progressIntersectionKnown;

  // Finished and Up To Date both require a verified released-episode boundary.
  // When TMDB cannot be verified, keep real episode progress as Watching and
  // never trust a stale persisted completion label.
  if (!verified) {
    if (watchedKeys.size > 0) {
      return {
        state: "watching",
        watchedAiredEpisodeCount: watchedKeys.size,
        airedEpisodeCount,
        futureOrUnknownWatchedEpisodeCount: 0,
        legacyCompletionAssumed,
        verified: false,
      };
    }
    return {
      state: persisted === "planned" ? "planned" : "not_started",
      watchedAiredEpisodeCount: 0,
      airedEpisodeCount,
      futureOrUnknownWatchedEpisodeCount,
      legacyCompletionAssumed,
      verified: false,
    };
  }

  if (watchedAiredEpisodeCount === 0) {
    return {
      state: persisted === "planned" ? "planned" : "not_started",
      watchedAiredEpisodeCount,
      airedEpisodeCount,
      futureOrUnknownWatchedEpisodeCount,
      legacyCompletionAssumed,
      verified: true,
    };
  }

  if (airedEpisodeCount! > 0 && watchedAiredEpisodeCount >= airedEpisodeCount!) {
    return {
      state: input.officiallyEnded === true ? "finished" : "uptodate",
      watchedAiredEpisodeCount,
      airedEpisodeCount,
      futureOrUnknownWatchedEpisodeCount,
      legacyCompletionAssumed,
      verified: true,
    };
  }

  return {
    state: "watching",
    watchedAiredEpisodeCount,
    airedEpisodeCount,
    futureOrUnknownWatchedEpisodeCount,
    legacyCompletionAssumed,
    verified: true,
  };
}

export function tvStateToMediaPatch(
  state: TvTrackingState,
  lastWatchedAt?: Date | string | null,
): { status: TvTrackingState; watched: boolean; watchedAt: Date | null } {
  const normalizedDate = lastWatchedAt
    ? (lastWatchedAt instanceof Date ? lastWatchedAt : new Date(lastWatchedAt))
    : null;
  const safeDate = normalizedDate && !Number.isNaN(normalizedDate.getTime()) ? normalizedDate : null;

  if (state === "finished") {
    return { status: state, watched: true, watchedAt: safeDate };
  }
  if (state === "uptodate" || state === "watching") {
    return { status: state, watched: false, watchedAt: safeDate };
  }
  return { status: state, watched: false, watchedAt: null };
}

export function tvTrackingStateLabel(state: TvTrackingState): string {
  if (state === "not_started") return "Not Started";
  if (state === "uptodate") return "Up To Date";
  return state.charAt(0).toUpperCase() + state.slice(1);
}
