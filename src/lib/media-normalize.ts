import {
  canonicalStateFromLegacy,
  compatibilityFieldsForState,
  isActiveMediaState,
} from "@/lib/media-state";

export function toJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      return value.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

export function fromJsonArray(value?: string | null): string[] {
  return toJsonArray(value);
}

export function encodeJsonArray(value: unknown): string {
  return JSON.stringify(toJsonArray(value));
}

/**
 * Converts the SQLite storage representation to the stable API representation.
 * It also derives deprecated fields from `libraryState`, so every page sees the
 * same state even while old clients still inspect `status`/`watched`.
 */
export function normalizeMedia<T extends Record<string, any>>(item: T) {
  const libraryState = canonicalStateFromLegacy(item);
  const compat = compatibilityFieldsForState(libraryState, item.type, {
    currentWatchedAt: item.watchedAt,
    now: item.stateChangedAt ?? item.updatedAt ?? new Date(),
  });

  const { genresJson, tagsJson, ...rest } = item;
  return {
    ...rest,
    genres: Array.isArray(item.genres) ? item.genres : fromJsonArray(genresJson),
    tags: Array.isArray(item.tags) ? item.tags : fromJsonArray(tagsJson),
    libraryState,
    status: compat.status,
    watched: compat.watched,
    watchedAt: compat.watchedAt,
    isTracked: isActiveMediaState(libraryState),
  };
}

export function normalizeMediaMany<T extends Record<string, any>>(items: T[]) {
  return items.map(normalizeMedia);
}
