export const CANONICAL_MEDIA_STATES = [
  "none",
  "planned",
  "watching",
  "up_to_date",
  "completed",
] as const;

export type CanonicalMediaState = (typeof CANONICAL_MEDIA_STATES)[number];
export type CanonicalMediaType = "movie" | "series" | "book" | "game" | string;

const STATE_SET = new Set<string>(CANONICAL_MEDIA_STATES);

export function isCanonicalMediaState(value: unknown): value is CanonicalMediaState {
  return typeof value === "string" && STATE_SET.has(value.trim().toLowerCase());
}

export function normalizeCanonicalState(value: unknown): CanonicalMediaState | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  if (isCanonicalMediaState(normalized)) return normalized;

  if (["watchlist", "following", "plan_to_watch", "planned"].includes(normalized)) return "planned";
  if (["in_progress", "progress", "watching"].includes(normalized)) return "watching";
  if (["uptodate", "up_to_date", "caught_up"].includes(normalized)) return "up_to_date";
  if (["watched", "finished", "complete", "completed"].includes(normalized)) return "completed";
  if (["removed", "untracked", "null", "none"].includes(normalized)) return "none";
  return null;
}

export function canonicalStateFromLegacy(item: {
  libraryState?: unknown;
  status?: unknown;
  watched?: unknown;
  watchedAt?: unknown;
  type?: unknown;
}): CanonicalMediaState {
  const stored = normalizeCanonicalState(item.libraryState);
  if (stored) return stored;

  const legacyStatus = normalizeCanonicalState(item.status);
  if (legacyStatus) return legacyStatus;

  if (item.watched === true) return "completed";
  if (String(item.type || "") === "movie" && item.watchedAt) return "completed";
  return "none";
}

export function isActiveMediaState(state: CanonicalMediaState | string | null | undefined) {
  return normalizeCanonicalState(state) !== "none" && normalizeCanonicalState(state) !== null;
}

export function legacyStatusForState(state: CanonicalMediaState, type: CanonicalMediaType): string | null {
  switch (state) {
    case "none":
      return null;
    case "planned":
      return "planned";
    case "watching":
      return "watching";
    case "up_to_date":
      return "uptodate";
    case "completed":
      return type === "series" ? "finished" : "watched";
  }
}

export function compatibilityFieldsForState(
  state: CanonicalMediaState,
  type: CanonicalMediaType,
  options: { currentWatchedAt?: Date | string | null; completedAt?: Date | string | null; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const currentWatchedAt = options.currentWatchedAt
    ? new Date(options.currentWatchedAt)
    : null;
  const completedAt = options.completedAt ? new Date(options.completedAt) : null;
  const workIsWatched = state === "completed" || state === "up_to_date";

  return {
    libraryState: state,
    status: legacyStatusForState(state, type),
    watched: workIsWatched,
    watchedAt:
      state === "completed" || state === "up_to_date"
        ? completedAt ?? currentWatchedAt ?? now
        : null,
    stateChangedAt: now,
  };
}

export function stateFromPatch(
  existing: { libraryState?: unknown; status?: unknown; watched?: unknown; watchedAt?: unknown; type?: unknown },
  patch: Record<string, unknown>,
): CanonicalMediaState {
  const explicit = normalizeCanonicalState(patch.libraryState);
  if (explicit) return explicit;

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    if (patch.status === null || patch.status === "") return "none";
    const statusState = normalizeCanonicalState(patch.status);
    if (statusState) return statusState;
  }

  if (patch.watched === true) return "completed";
  if (patch.watched === false) {
    const current = canonicalStateFromLegacy(existing);
    return current === "none" ? "none" : "planned";
  }

  // Rating, notes, poster updates, etc. never change tracking state.
  return canonicalStateFromLegacy(existing);
}

export function mergeCanonicalStates(
  left: CanonicalMediaState,
  right: CanonicalMediaState,
): CanonicalMediaState {
  const priority: Record<CanonicalMediaState, number> = {
    none: 0,
    planned: 1,
    watching: 2,
    up_to_date: 3,
    completed: 4,
  };
  return priority[right] > priority[left] ? right : left;
}

export function queryStatesFromLegacyStatus(status: string): CanonicalMediaState[] {
  return status
    .split(",")
    .map((part) => normalizeCanonicalState(part))
    .filter((state): state is CanonicalMediaState => Boolean(state));
}


export function availableEpisodeCountFromTmdb(detail: any): number | null {
  if (!detail || typeof detail !== "object") return null;

  const status = String(detail.status || "").trim().toLowerCase();
  const ended = ["ended", "canceled", "cancelled"].includes(status);
  const total = Number(detail.number_of_episodes || 0);
  if (ended && total > 0) return total;

  const last = detail.last_episode_to_air;
  const lastSeason = Number(last?.season_number || 0);
  const lastEpisode = Number(last?.episode_number || 0);
  if (lastSeason > 0 && lastEpisode > 0 && Array.isArray(detail.seasons)) {
    const priorEpisodes = detail.seasons
      .filter((season: any) => Number(season?.season_number || 0) > 0 && Number(season.season_number) < lastSeason)
      .reduce((sum: number, season: any) => sum + Math.max(0, Number(season?.episode_count || 0)), 0);
    return priorEpisodes + lastEpisode;
  }

  // No episode has aired yet. Returning zero prevents future episodes from
  // making an ongoing show look complete.
  return last ? Math.max(0, lastEpisode) : 0;
}

export function deriveSeriesProgressState(args: {
  currentState: CanonicalMediaState;
  watchedEpisodes: number;
  totalEpisodes?: number | null;
  isEnded?: boolean | null;
  preserveManualCompletionWhenNoEpisodeFacts?: boolean;
}): CanonicalMediaState {
  const { currentState, watchedEpisodes } = args;
  const totalEpisodes = Number(args.totalEpisodes || 0);
  const isEnded = args.isEnded === true;

  if (currentState === "none") return "none";

  const completedKnownSet = totalEpisodes > 0 && watchedEpisodes >= totalEpisodes;
  if (completedKnownSet) return isEnded ? "completed" : "up_to_date";

  if (watchedEpisodes > 0) return "watching";

  // A legacy/manual completed row may not have episode facts. Preserve it on
  // read, but explicit episode mutations can disable this fallback so removing
  // progress immediately moves the show back to planned/watching.
  if (args.preserveManualCompletionWhenNoEpisodeFacts !== false) {
    if (currentState === "completed") return isEnded ? "completed" : "up_to_date";
    if (currentState === "up_to_date") return isEnded ? "completed" : "up_to_date";
  }

  return "planned";
}

export function trackingBucketForState(state: CanonicalMediaState): "watchlist" | "uptodate" | "finished" {
  if (state === "completed") return "finished";
  if (state === "up_to_date") return "uptodate";
  return "watchlist";
}
