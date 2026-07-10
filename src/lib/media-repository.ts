import { db } from "@/lib/db";
import { encodeJsonArray } from "@/lib/media-normalize";
import {
  canonicalStateFromLegacy,
  compatibilityFieldsForState,
  mergeCanonicalStates,
  normalizeCanonicalState,
  type CanonicalMediaState,
} from "@/lib/media-state";

export function canonicalMediaType(value: unknown): string {
  return value === "tv" ? "series" : String(value || "movie");
}

export function normalizePosterUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const poster = value.trim();
  if (!poster) return null;
  if (/^(https?:|data:|blob:)/i.test(poster)) return poster;
  if (poster.startsWith("/placeholder-") || poster === "/logo.svg") return poster;
  if (poster.startsWith("/")) return `https://image.tmdb.org/t/p/w500${poster}`;
  return poster;
}

export async function findCanonicalMedia(userId: string, type: string, tmdbId: number) {
  return db.media.findFirst({ where: { userId, type: canonicalMediaType(type), tmdbId } });
}

export async function ensureCanonicalMedia(args: {
  userId: string;
  tmdbId?: number | null;
  title: string;
  type: string;
  poster?: string | null;
  year?: string | null;
  overview?: string | null;
  rating?: string | number | null;
  runtime?: number | null;
  genres?: unknown;
  seasons?: number | null;
  episodes?: number | null;
  isAnime?: boolean;
  initialState?: CanonicalMediaState | string | null;
}) {
  const type = canonicalMediaType(args.type);
  const tmdbId = args.tmdbId == null ? null : Number(args.tmdbId);
  const safeTitle = args.title.trim();
  const requestedState = normalizeCanonicalState(args.initialState) ?? "none";

  let item = tmdbId
    ? await db.media.findFirst({ where: { userId: args.userId, tmdbId, type } })
    : await db.media.findFirst({ where: { userId: args.userId, title: safeTitle, type, tmdbId: null } });

  if (!item) {
    const compat = compatibilityFieldsForState(requestedState, type);
    return db.media.create({
      data: {
        userId: args.userId,
        tmdbId,
        title: safeTitle,
        type,
        poster: normalizePosterUrl(args.poster),
        year: args.year || null,
        overview: args.overview || null,
        rating: args.rating != null ? String(args.rating) : null,
        runtime: args.runtime != null ? Number(args.runtime) : null,
        seasons: args.seasons != null ? Number(args.seasons) : null,
        episodes: args.episodes != null ? Number(args.episodes) : null,
        genresJson: encodeJsonArray(args.genres),
        isAnime: Boolean(args.isAnime),
        ...compat,
      },
    });
  }

  const updates: Record<string, any> = {};
  if (safeTitle && item.title !== safeTitle) updates.title = safeTitle;
  const normalizedPoster = normalizePosterUrl(args.poster);
  if (normalizedPoster && item.poster !== normalizedPoster) updates.poster = normalizedPoster;
  if (args.overview && item.overview !== args.overview) updates.overview = args.overview;
  if (args.year && item.year !== args.year) updates.year = args.year;
  if (args.rating != null && item.rating !== String(args.rating)) updates.rating = String(args.rating);
  if (args.runtime != null && item.runtime !== Number(args.runtime)) updates.runtime = Number(args.runtime);
  if (args.seasons != null && item.seasons !== Number(args.seasons)) updates.seasons = Number(args.seasons);
  if (args.episodes != null && item.episodes !== Number(args.episodes)) updates.episodes = Number(args.episodes);
  if (args.genres !== undefined) {
    const encoded = encodeJsonArray(args.genres);
    if (encoded !== item.genresJson) updates.genresJson = encoded;
  }
  if (args.isAnime !== undefined && item.isAnime !== Boolean(args.isAnime)) updates.isAnime = Boolean(args.isAnime);

  const currentState = canonicalStateFromLegacy(item);
  const mergedState = mergeCanonicalStates(currentState, requestedState);
  if (mergedState !== currentState || item.libraryState !== currentState) {
    Object.assign(updates, compatibilityFieldsForState(mergedState, type, { currentWatchedAt: item.watchedAt }));
  }

  if (Object.keys(updates).length === 0) return item;
  return db.media.update({ where: { id: item.id }, data: updates });
}

export async function updateCanonicalMediaState(
  item: {
    id: string;
    type: string;
    watchedAt?: Date | null;
  },
  state: CanonicalMediaState,
  options: { completedAt?: Date | string | null; data?: Record<string, any> } = {},
) {
  return db.media.update({
    where: { id: item.id },
    data: {
      ...(options.data || {}),
      ...compatibilityFieldsForState(state, item.type, {
        currentWatchedAt: item.watchedAt,
        completedAt: options.completedAt,
      }),
    },
  });
}
