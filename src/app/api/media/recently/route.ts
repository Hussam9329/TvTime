import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { tmdb, tmdbArabic } from "@/lib/tmdb";
import { isOfficiallyEndedTvStatus } from "@/lib/tv-status-engine";

type RecentlyItem = {
  id: string;
  kind: "movie" | "tv";
  tmdbId: number | null;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  watchedAt: string;
  subtitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeName?: string | null;
  hasProfile: boolean;
  source: "media" | "watched-episode";
  isArabic: boolean;
  isAnime: boolean;
  category: "movie" | "tv" | "anime" | "arabic-movie" | "arabic-tv";
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function validTmdbId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function addUnique(map: Map<string, RecentlyItem>, item: RecentlyItem) {
  const key = `${item.kind}:${item.tmdbId ?? item.id}`;
  const existing = map.get(key);
  if (!existing || new Date(item.watchedAt).getTime() > new Date(existing.watchedAt).getTime()) {
    map.set(key, item);
  }
}

function deriveCategory(kind: "movie" | "tv", isArabic: boolean, isAnime: boolean): RecentlyItem["category"] {
  if (isArabic) return kind === "movie" ? "arabic-movie" : "arabic-tv";
  if (isAnime) return "anime";
  return kind === "movie" ? "movie" : "tv";
}

/**
 * Fetch backdrop_path + overview from TMDB for a movie or TV show.
 * Uses tmdbArabic for Arabic items to get Arabic overview.
 * Returns null on failure (the caller falls back to poster only).
 */
async function fetchTmdbBackdrop(
  tmdbId: number,
  kind: "movie" | "tv",
  isArabic: boolean
): Promise<{ backdropPath: string | null; overview: string | null }> {
  try {
    const client = isArabic ? tmdbArabic : tmdb;
    if (kind === "movie") {
      const detail = await client.movieDetail(tmdbId);
      return {
        backdropPath: detail.backdrop_path || null,
        overview: detail.overview || null,
      };
    } else {
      const detail = await client.tvDetail(tmdbId);
      return {
        backdropPath: detail.backdrop_path || null,
        overview: detail.overview || null,
      };
    }
  } catch {
    return { backdropPath: null, overview: null };
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 12, 1), 50);

    const [mediaMovies, mediaShows] = await Promise.all([
      db.media.findMany({
        where: { userId: user.id, type: "movie", watched: true },
        orderBy: [{ watchedAt: "desc" }, { updatedAt: "desc" }],
        take: 100,
        select: { id: true, tmdbId: true, title: true, poster: true, watchedAt: true, updatedAt: true, isArabic: true, isAnime: true },
      }),
      db.media.findMany({
        where: { userId: user.id, type: "series", tmdbId: { not: null } },
        select: { tmdbId: true, title: true, poster: true, isArabic: true, isAnime: true },
      }),
    ]);

    const showIds = mediaShows
      .map((show) => validTmdbId(show.tmdbId))
      .filter((id): id is number => id != null);
    const watchedEpisodes = showIds.length
      ? await db.watchedEpisode.findMany({
          where: { userId: user.id, showId: { in: showIds } },
          orderBy: { watchedAt: "desc" },
          take: 200,
        })
      : [];
    const showMeta = new Map<number, { title: string; posterPath: string | null; isArabic: boolean; isAnime: boolean }>();
    for (const show of mediaShows) {
      const id = validTmdbId(show.tmdbId);
      if (id) showMeta.set(id, { title: show.title, posterPath: show.poster ?? null, isArabic: show.isArabic, isAnime: show.isAnime });
    }

    const items = new Map<string, RecentlyItem>();
    for (const movie of mediaMovies) {
      const tmdbId = validTmdbId(movie.tmdbId);
      const isArabic = movie.isArabic;
      const isAnime = movie.isAnime;
      addUnique(items, {
        id: movie.id,
        kind: "movie",
        tmdbId,
        title: movie.title,
        posterPath: movie.poster ?? null,
        backdropPath: null,
        overview: null,
        watchedAt: toIso(movie.watchedAt ?? movie.updatedAt),
        hasProfile: tmdbId != null,
        source: "media",
        isArabic,
        isAnime,
        category: deriveCategory("movie", isArabic, isAnime),
      });
    }

    for (const episode of watchedEpisodes) {
      const tmdbId = validTmdbId(episode.showId);
      const meta = tmdbId ? showMeta.get(tmdbId) : null;
      const isArabic = meta?.isArabic ?? false;
      const isAnime = meta?.isAnime ?? false;
      addUnique(items, {
        id: episode.id,
        kind: "tv",
        tmdbId,
        title: meta?.title ?? `TV Show #${episode.showId}`,
        posterPath: meta?.posterPath ?? null,
        backdropPath: null,
        overview: null,
        watchedAt: toIso(episode.watchedAt),
        subtitle: `S${episode.seasonNumber} • E${episode.episodeNumber}`,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.episodeName,
        hasProfile: tmdbId != null,
        source: "watched-episode",
        isArabic,
        isAnime,
        category: deriveCategory("tv", isArabic, isAnime),
      });
    }

    const sorted = Array.from(items.values())
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .slice(0, limit);

    // ── Fetch backdrop_path + overview from TMDB for the top items ──────
    // We only fetch for the first 6 unique items (one per category) to avoid
    // hammering TMDB. These are the ones that appear in the Featured carousel.
    const seenCats = new Set<string>();
    const toEnrich: RecentlyItem[] = [];
    for (const item of sorted) {
      if (!item.tmdbId || seenCats.has(item.category)) continue;
      seenCats.add(item.category);
      toEnrich.push(item);
      if (toEnrich.length >= 6) break;
    }

    // Fetch in parallel (max 6 TMDB calls)
    await Promise.all(
      toEnrich.map(async (item) => {
        const result = await fetchTmdbBackdrop(item.tmdbId!, item.kind, item.isArabic);
        item.backdropPath = result.backdropPath;
        item.overview = result.overview;
      })
    );

    return NextResponse.json({ items: sorted, total: sorted.length, source: "AllMedia+WatchedEpisode+TMDB" });
  } catch (error) {
    console.error("[media:recently]", error);
    return NextResponse.json({ error: "Failed to load recently watched" }, { status: 500 });
  }
}
