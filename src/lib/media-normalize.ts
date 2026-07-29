import { canonicalMediaPoster } from "@/lib/media-poster";

function fromJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// For PostgreSQL, genres and tags are already string[] - just pass through
export function normalizeMedia<T extends Record<string, any>>(item: T) {
  return {
    ...item,
    poster: canonicalMediaPoster(item.poster),
    genres: Array.isArray(item.genres) ? item.genres : (item.genresJson ? fromJsonArray(item.genresJson) : []),
    tags: Array.isArray(item.tags) ? item.tags : (item.tagsJson ? fromJsonArray(item.tagsJson) : []),
  };
}

export function normalizeMediaMany<T extends Record<string, any>>(items: T[]) {
  return items.map(normalizeMedia);
}
