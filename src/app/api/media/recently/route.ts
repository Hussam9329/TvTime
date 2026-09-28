import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { classifyMediaWorld } from "@/lib/media-world-classification";

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
  status?: string | null;
  userRating?: number | null;
  publicRating?: number | null;
  year?: string | null;
  isAnime?: boolean;
  /** TV only: episodes watched and the show's episode total, for progress. */
  watchedEpisodeCount?: number | null;
  totalEpisodes?: number | null;
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

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 12, 1), 50);

    const [mediaMovies, mediaShows] = await Promise.all([
      db.media.findMany({
        where: { userId: user.id, type: "movie", watched: true },
        orderBy: [{ watchedAt: "desc" }, { updatedAt: "desc" }],
        take: 100,
      }),
      db.media.findMany({
        where: { userId: user.id, type: "series", tmdbId: { not: null } },
      }),
    ]);
    const [classifiedMovies, classifiedShows] = await Promise.all([
      resolveGeneralMediaClassifications(mediaMovies, { allowNetwork: false }),
      resolveGeneralMediaClassifications(mediaShows, { allowNetwork: false }),
    ]);
    const nonArabicMovies = classifiedMovies.filter((item) =>
      !classifyMediaWorld(item).isArabic);
    const nonArabicShows = classifiedShows.filter((item) =>
      !classifyMediaWorld(item).isArabic);

    const showIds = nonArabicShows
      .map((show) => validTmdbId(show.tmdbId))
      .filter((id): id is number => id != null);
    const watchedEpisodes = showIds.length
      ? await db.watchedEpisode.findMany({
          where: { userId: user.id, showId: { in: showIds } },
          orderBy: { watchedAt: "desc" },
          take: 200,
        })
      : [];
    const watchedCounts = showIds.length
      ? await db.watchedEpisode.groupBy({
          by: ["showId"],
          where: { userId: user.id, showId: { in: showIds } },
          _count: { _all: true },
        })
      : [];
    const watchedCountByShow = new Map(watchedCounts.map((row) => [row.showId, row._count._all] as const));
    const showMeta = new Map<number, {
      title: string;
      posterPath: string | null;
      status: string | null;
      userRating: number | null;
      publicRating: number | null;
      year: string | null;
      isAnime: boolean;
      totalEpisodes: number | null;
    }>();
    for (const show of nonArabicShows) {
      const id = validTmdbId(show.tmdbId);
      if (id) {
        showMeta.set(id, {
          title: show.title,
          posterPath: show.poster ?? null,
          status: show.status,
          userRating: show.userRating,
          publicRating: show.rating ? Number.parseFloat(show.rating) : null,
          year: show.year ?? null,
          isAnime: show.isAnime,
          totalEpisodes: show.episodes ?? null,
        });
      }
    }

    const items = new Map<string, RecentlyItem>();
    for (const movie of nonArabicMovies) {
      const tmdbId = validTmdbId(movie.tmdbId);
      addUnique(items, {
        id: movie.id,
        kind: "movie",
        tmdbId,
        title: movie.title,
        posterPath: movie.poster ?? null,
        watchedAt: toIso(movie.watchedAt ?? movie.updatedAt),
        hasProfile: tmdbId != null,
        source: "media",
        status: movie.status,
        userRating: movie.userRating,
        publicRating: movie.rating ? Number.parseFloat(movie.rating) : null,
        year: movie.year ?? null,
        isAnime: movie.isAnime,
      });
    }

    for (const episode of watchedEpisodes) {
      const tmdbId = validTmdbId(episode.showId);
      const meta = tmdbId ? showMeta.get(tmdbId) : null;
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
        status: meta?.status ?? null,
        userRating: meta?.userRating ?? null,
        publicRating: meta?.publicRating ?? null,
        year: meta?.year ?? null,
        isAnime: meta?.isAnime ?? false,
        watchedEpisodeCount: tmdbId ? watchedCountByShow.get(tmdbId) ?? null : null,
        totalEpisodes: meta?.totalEpisodes ?? null,
      });
    }

    const sorted = Array.from(items.values())
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ items: sorted, total: sorted.length, source: "NonArabicMedia+WatchedEpisode" });
  } catch (error) {
    console.error("[media:recently]", error);
    return NextResponse.json({ error: "Failed to load recently watched" }, { status: 500 });
  }
}
