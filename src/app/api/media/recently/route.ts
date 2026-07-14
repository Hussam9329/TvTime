import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

type RecentlyItem = {
  id: string;
  kind: "movie" | "tv";
  tmdbId: number | null;
  title: string;
  posterPath: string | null;
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

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 12, 1), 50);

    // Fetch ALL watched media (movies + series) regardless of Arabic/Anime flags.
    // The category is derived per-item so the home page can show one slide
    // per category (movie, tv, anime, arabic-movie, arabic-tv).
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

    return NextResponse.json({ items: sorted, total: sorted.length, source: "AllMedia+WatchedEpisode" });
  } catch (error) {
    console.error("[media:recently]", error);
    return NextResponse.json({ error: "Failed to load recently watched" }, { status: 500 });
  }
}
