// Media normalizer for PostgreSQL (arrays are native, so this is mostly pass-through)
// Kept for API compatibility with code that expects genresJson/tagsJson pattern

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
    genres: Array.isArray(item.genres) ? item.genres : (item.genresJson ? fromJsonArray(item.genresJson) : []),
    tags: Array.isArray(item.tags) ? item.tags : (item.tagsJson ? fromJsonArray(item.tagsJson) : []),
  };
}

export function normalizeMediaMany<T extends Record<string, any>>(items: T[]) {
  return items.map(normalizeMedia);
}
