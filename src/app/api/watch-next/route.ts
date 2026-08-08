import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { classifyMediaWorld } from "@/lib/media-world-classification";
import { shouldExcludeFromWatchNext } from "@/lib/watch-next-state";

function episodeParts(key: string) {
  const [season, episode] = key.split("-").map(Number);
  return Number.isInteger(season) && Number.isInteger(episode) ? { season, episode } : null;
}

function posterUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? `https://image.tmdb.org/t/p/w342${value}` : null;
}

function estimatedRuntimeMinutes(value: number | null | undefined, duration: string | null | undefined) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Math.round(Number(value));
  const match = String(duration ?? "").match(/(\d{1,3})/);
  return match ? Math.max(1, Number(match[1])) : 45;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const storedShows = await db.media.findMany({
      where: { userId: user.id, type: "series", isFollowing: true, tmdbId: { not: null } },
      select: { tmdbId: true, type: true, title: true, poster: true, watchedAt: true, updatedAt: true, watched: true, status: true, userRating: true, tags: true, runtime: true, duration: true, isAnime: true, isArabic: true, originalLanguage: true, originCountries: true, genres: true },
    });
    const shows = await resolveGeneralMediaClassifications(storedShows, { allowNetwork: false });
    const ids = shows.map((show) => show.tmdbId!).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({
      items: [],
      upcoming: [],
      upToDate: [],
      summary: { readyEpisodes: 0, estimatedMinutes: 0 },
    });
    const [metadata, watched] = await Promise.all([
      db.tvMetadataCache.findMany({
        where: { tmdbId: { in: ids } },
        select: {
          tmdbId: true,
          posterPath: true,
          officiallyEnded: true,
          airedEpisodeKeys: true,
          nextEpisodeAirDate: true,
          nextEpisodeName: true,
          nextEpisodeSeasonNumber: true,
          nextEpisodeEpisodeNumber: true,
        },
      }),
      db.watchedEpisode.findMany({
        where: { userId: user.id, showId: { in: ids } },
        select: { showId: true, seasonNumber: true, episodeNumber: true, watchedAt: true, runtime: true },
      }),
    ]);
    const watchedByShow = new Map<number, { keys: Set<string>; lastWatchedAt: Date | null; runtimes: number[] }>();
    for (const row of watched) {
      const current = watchedByShow.get(row.showId) ?? { keys: new Set<string>(), lastWatchedAt: null, runtimes: [] };
      current.keys.add(`${row.seasonNumber}-${row.episodeNumber}`);
      if (!current.lastWatchedAt || row.watchedAt > current.lastWatchedAt) current.lastWatchedAt = row.watchedAt;
      if (row.runtime != null && row.runtime > 0) current.runtimes.push(row.runtime);
      watchedByShow.set(row.showId, current);
    }
    const metadataById = new Map(metadata.map((row) => [row.tmdbId, row]));
    const eligibleShows = shows.filter((show) => {
      const meta = metadataById.get(show.tmdbId!);
      return !shouldExcludeFromWatchNext({
        status: show.status,
        watched: show.watched,
        userRating: show.userRating,
        tags: show.tags,
        officiallyEnded: meta?.officiallyEnded,
      });
    });
    const timelines = eligibleShows.map((show) => {
      const meta = metadataById.get(show.tmdbId!);
      const watchedMeta = watchedByShow.get(show.tmdbId!) ?? { keys: new Set<string>(), lastWatchedAt: null, runtimes: [] };
      const released = (meta?.airedEpisodeKeys ?? []).map(episodeParts).filter((value): value is { season: number; episode: number } => Boolean(value))
        .sort((a, b) => a.season - b.season || a.episode - b.episode)
      const ready = released.filter((episode) => !watchedMeta.keys.has(`${episode.season}-${episode.episode}`));
      const watchedReleasedEpisodes = released.length - ready.length;
      const watchedRuntime = watchedMeta.runtimes.length > 0
        ? Math.round(watchedMeta.runtimes.reduce((sum, runtime) => sum + runtime, 0) / watchedMeta.runtimes.length)
        : null;
      const poster = posterUrl(show.poster) || posterUrl(meta?.posterPath);
      const classification = classifyMediaWorld(show);
      return {
        tmdbId: show.tmdbId!,
        title: show.title,
        poster,
        next: ready[0] ?? null,
        readyEpisodes: ready.length,
        watchedEpisodes: watchedReleasedEpisodes,
        releasedEpisodes: released.length,
        estimatedRuntime: estimatedRuntimeMinutes(show.runtime ?? watchedRuntime, show.duration),
        lastActivity: watchedMeta.lastWatchedAt || show.watchedAt || show.updatedAt,
        status: show.status,
        isAnime: classification.isAnime,
        isArabic: classification.isArabic,
        meta,
      };
    });
    const allReadyItems = timelines.flatMap((item) => item.next ? [{
      tmdbId: item.tmdbId,
      title: item.title,
      poster: item.poster,
      seasonNumber: item.next.season,
      episodeNumber: item.next.episode,
      readyEpisodes: item.readyEpisodes,
      watchedEpisodes: item.watchedEpisodes,
      releasedEpisodes: item.releasedEpisodes,
      estimatedRuntime: item.estimatedRuntime,
      lastActivity: item.lastActivity,
      status: item.status,
      isAnime: item.isAnime,
      isArabic: item.isArabic,
    }] : []).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = timelines.flatMap((item) => {
      const meta = item.meta;
      if (
        item.readyEpisodes > 0
        || !meta?.nextEpisodeAirDate
        || meta.nextEpisodeAirDate <= today
        || meta.nextEpisodeSeasonNumber == null
        || meta.nextEpisodeEpisodeNumber == null
      ) return [];
      return [{
        tmdbId: item.tmdbId,
        title: item.title,
        poster: item.poster,
        seasonNumber: meta.nextEpisodeSeasonNumber,
        episodeNumber: meta.nextEpisodeEpisodeNumber,
        episodeName: meta.nextEpisodeName,
        airDate: meta.nextEpisodeAirDate,
        estimatedRuntime: item.estimatedRuntime,
        isAnime: item.isAnime,
        isArabic: item.isArabic,
      }];
    }).sort((a, b) => a.airDate.localeCompare(b.airDate));
    const upcomingIds = new Set(upcoming.map((item) => item.tmdbId));
    const upToDate = timelines
      .filter((item) =>
        item.readyEpisodes === 0
        && item.releasedEpisodes > 0
        && item.watchedEpisodes === item.releasedEpisodes
        && item.meta
        && !upcomingIds.has(item.tmdbId))
      .map((item) => ({
        tmdbId: item.tmdbId,
        title: item.title,
        poster: item.poster,
        watchedEpisodes: item.watchedEpisodes,
        releasedEpisodes: item.releasedEpisodes,
        lastActivity: item.lastActivity,
        status: item.status,
        isAnime: item.isAnime,
        isArabic: item.isArabic,
      }))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    const summary = allReadyItems.reduce((result, item) => ({
      readyEpisodes: result.readyEpisodes + item.readyEpisodes,
      estimatedMinutes: result.estimatedMinutes + item.readyEpisodes * item.estimatedRuntime,
    }), { readyEpisodes: 0, estimatedMinutes: 0 });
    return NextResponse.json({ items: allReadyItems.slice(0, 20), upcoming, upToDate: upToDate.slice(0, 20), summary });
  } catch (error) {
    console.error("[watch-next]", error);
    return NextResponse.json({ error: "Failed to build Watch Next" }, { status: 500 });
  }
}
