import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { classifyMediaWorld } from "@/lib/media-world-classification";
import { shouldExcludeFromWatchNext } from "@/lib/watch-next-state";
import { getTvSeasonDetail } from "@/lib/tv-status-server";
import { tmdb, type EpisodeStillImage, type SeasonDetail } from "@/lib/tmdb";

const WATCH_NEXT_VISIBLE_LIMIT = 20;
const WATCH_NEXT_SEASON_ENRICHMENT_LIMIT = 8;
const WATCH_NEXT_STILL_ENRICHMENT_LIMIT = 6;
const WATCH_NEXT_SEASON_TIMEOUT_MS = 1_200;
const WATCH_NEXT_STILL_TIMEOUT_MS = 1_100;

function episodeParts(key: string) {
  const [season, episode] = key.split("-").map(Number);
  return Number.isInteger(season) && Number.isInteger(episode) ? { season, episode } : null;
}

function tmdbImageUrl(value: string | null | undefined, size: "w342" | "original") {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? `https://image.tmdb.org/t/p/${size}${value}` : null;
}

function posterUrl(value: string | null | undefined) {
  return tmdbImageUrl(value, "w342");
}

function landscapeUrl(value: string | null | undefined) {
  return tmdbImageUrl(value, "original");
}

function episodeStillUrl(value: string | null | undefined) {
  // Episode stills are already landscape artwork. Keep the original TMDB
  // source and let next/image negotiate the delivered size/format.
  return tmdbImageUrl(value, "original");
}

function estimatedRuntimeMinutes(value: number | null | undefined, duration: string | null | undefined) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Math.round(Number(value));
  const match = String(duration ?? "").match(/(\d{1,3})/);
  return match ? Math.max(1, Number(match[1])) : 45;
}

function imageScore(image: EpisodeStillImage) {
  const width = Math.max(1, Number(image.width) || 1);
  const height = Math.max(1, Number(image.height) || 1);
  const ratio = Number(image.aspect_ratio) > 0 ? Number(image.aspect_ratio) : width / height;
  const ratioPenalty = Math.abs(ratio - 16 / 9) * 1_800;
  const resolution = Math.min(width * height, 3_000_000) / 2_500;
  const votes = Math.max(0, Number(image.vote_average) || 0) * 24 + Math.min(50, Number(image.vote_count) || 0) * 2;
  return resolution + votes - ratioPenalty;
}

function bestEpisodeStill(images: EpisodeStillImage[] | null | undefined, fallback?: string | null) {
  const best = (images ?? [])
    .filter((image) => Boolean(image?.file_path))
    .sort((left, right) => imageScore(right) - imageScore(left))[0];
  return episodeStillUrl(best?.file_path) || episodeStillUrl(fallback);
}

function seasonBackdrop(season: SeasonDetail | undefined, episodeNumber: number) {
  if (!season?.episodes?.length) return null;
  const candidates = season.episodes
    .filter((episode) => Boolean(episode.still_path))
    .map((episode) => ({
      episode,
      score: Math.max(0, Number(episode.vote_average) || 0) * 25 - Math.abs(episode.episode_number - episodeNumber) * 1.2,
    }))
    .sort((left, right) => right.score - left.score);
  return landscapeUrl(candidates[0]?.episode.still_path);
}

function isSeasonFinale(season: SeasonDetail | undefined, episodeNumber: number) {
  const regularEpisodes = (season?.episodes ?? []).filter((episode) => episode.episode_number > 0);
  if (regularEpisodes.length === 0) return false;
  const lastEpisodeNumber = Math.max(...regularEpisodes.map((episode) => episode.episode_number));
  return episodeNumber === lastEpisodeNumber;
}

function releasedAfterLastWatch(airDate: string | null | undefined, lastWatchedAt: Date | null, watchedEpisodes: number) {
  if (!airDate || !lastWatchedAt || watchedEpisodes <= 0) return false;
  const watchedDay = lastWatchedAt.toISOString().slice(0, 10);
  return airDate > watchedDay;
}

function serverPriority(item: {
  readyEpisodes: number;
  watchedEpisodes: number;
  releasedEpisodes: number;
  lastActivity: Date;
}) {
  const progress = Math.min(100, Math.max(0, Math.round((item.watchedEpisodes / Math.max(item.releasedEpisodes, 1)) * 100)));
  const completionBoost = progress * 3;
  const nearCompletionBoost = progress >= 70 ? Math.round((progress / 100) * 650) : 0;
  const oneReadyBoost = item.readyEpisodes === 1 ? 540 : 0;
  const activityAge = Math.max(0, Math.floor((Date.now() - item.lastActivity.getTime()) / 86_400_000));
  const returnBoost = activityAge >= 21 ? Math.min(520, (activityAge - 20) * 9) : 0;
  const recentMomentum = item.watchedEpisodes > 0 && activityAge < 14 ? (14 - activityAge) * 24 : 0;
  const backlogPenalty = Math.max(0, item.readyEpisodes - 4) * 32;
  return completionBoost + nearCompletionBoost + oneReadyBoost + returnBoost + recentMomentum - backlogPenalty;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const storedShows = await db.media.findMany({
      where: { userId: user.id, type: "series", isFollowing: true, tmdbId: { not: null } },
      select: {
        tmdbId: true,
        type: true,
        title: true,
        poster: true,
        watchedAt: true,
        updatedAt: true,
        watched: true,
        status: true,
        userRating: true,
        tags: true,
        runtime: true,
        duration: true,
        isAnime: true,
        isArabic: true,
        originalLanguage: true,
        originCountries: true,
        genres: true,
      },
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
          totalSeasons: true,
          lastSeasonNumber: true,
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
      const released = (meta?.airedEpisodeKeys ?? [])
        .map(episodeParts)
        .filter((value): value is { season: number; episode: number } => Boolean(value))
        .sort((a, b) => a.season - b.season || a.episode - b.episode);
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
        // Canonical Media deliberately does not duplicate TMDB backdrops. The
        // featured client resolves the show backdrop only when both episode and
        // season artwork are unavailable; compact cards remain network-free.
        showBackdrop: null,
        next: ready[0] ?? null,
        following: ready[1] ?? (
          ready.length === 1
          && meta?.nextEpisodeSeasonNumber != null
          && meta?.nextEpisodeEpisodeNumber != null
            ? { season: meta.nextEpisodeSeasonNumber, episode: meta.nextEpisodeEpisodeNumber }
            : null
        ),
        readyEpisodes: ready.length,
        watchedEpisodes: watchedReleasedEpisodes,
        releasedEpisodes: released.length,
        estimatedRuntime: estimatedRuntimeMinutes(show.runtime ?? watchedRuntime, show.duration),
        lastActivity: watchedMeta.lastWatchedAt || show.watchedAt || show.updatedAt,
        lastWatchedAt: watchedMeta.lastWatchedAt,
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
      showBackdrop: item.showBackdrop,
      seasonNumber: item.next.season,
      episodeNumber: item.next.episode,
      followingSeasonNumber: item.following?.season ?? null,
      followingEpisodeNumber: item.following?.episode ?? null,
      readyEpisodes: item.readyEpisodes,
      watchedEpisodes: item.watchedEpisodes,
      releasedEpisodes: item.releasedEpisodes,
      estimatedRuntime: item.estimatedRuntime,
      lastActivity: item.lastActivity,
      lastWatchedAt: item.lastWatchedAt,
      status: item.status,
      isAnime: item.isAnime,
      isArabic: item.isArabic,
      lastSeasonNumber: item.meta?.lastSeasonNumber ?? item.meta?.totalSeasons ?? null,
    }] : []).sort((a, b) =>
      serverPriority(b) - serverPriority(a)
      || b.lastActivity.getTime() - a.lastActivity.getTime());

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
        && item.meta?.officiallyEnded === false
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

    // Keep enrichment bounded: prioritize the featured current/following season,
    // then the smartest visible queue items. Titles outside this cap still use
    // cached show artwork, so Watch Next never turns into a TMDB N+1 waterfall.
    const visibleItems = allReadyItems.slice(0, WATCH_NEXT_VISIBLE_LIMIT);
    const featuredFollowing = visibleItems[0]?.followingSeasonNumber != null
      && visibleItems[0].followingSeasonNumber !== visibleItems[0].seasonNumber
        ? [[
            `${visibleItems[0].tmdbId}:${visibleItems[0].followingSeasonNumber}`,
            { tmdbId: visibleItems[0].tmdbId, seasonNumber: visibleItems[0].followingSeasonNumber },
          ] as const]
        : [];
    const currentSeasons = visibleItems.map((item) => [
      `${item.tmdbId}:${item.seasonNumber}`,
      { tmdbId: item.tmdbId, seasonNumber: item.seasonNumber },
    ] as const);
    const otherFollowing = visibleItems.flatMap((item) =>
      item.followingSeasonNumber != null && item.followingSeasonNumber !== item.seasonNumber
        ? [[
            `${item.tmdbId}:${item.followingSeasonNumber}`,
            { tmdbId: item.tmdbId, seasonNumber: item.followingSeasonNumber },
          ] as const]
        : []);
    const seasonKeys = [...new Map([
      ...(currentSeasons.slice(0, 1)),
      ...featuredFollowing,
      ...(currentSeasons.slice(1)),
      ...otherFollowing,
    ]).values()].slice(0, WATCH_NEXT_SEASON_ENRICHMENT_LIMIT);

    // TMDB can expose several stills for one episode. Rank only the first few
    // prominent queue items by 16:9 fit, resolution and community votes; the
    // remainder uses the season payload's canonical still to avoid an N+1 storm.
    // Season metadata and alternate-still lookups run in parallel so this richer
    // response does not become a serial waterfall.
    const stillTargets = visibleItems.slice(0, WATCH_NEXT_STILL_ENRICHMENT_LIMIT);
    const stillTargetKeys = new Set(stillTargets.map((item) => `${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`));
    const [seasonResults, stillResults] = await Promise.all([
      Promise.allSettled(
        seasonKeys.map(({ tmdbId, seasonNumber }) => getTvSeasonDetail(
          tmdbId,
          seasonNumber,
          { timeoutMs: WATCH_NEXT_SEASON_TIMEOUT_MS },
        )),
      ),
      Promise.allSettled(stillTargets.map((item) =>
        tmdb.episodeImages(item.tmdbId, item.seasonNumber, item.episodeNumber, { timeoutMs: WATCH_NEXT_STILL_TIMEOUT_MS }))),
    ]);
    const seasonsByKey = new Map(seasonResults.flatMap((result, index) =>
      result.status === "fulfilled"
        ? [[`${seasonKeys[index].tmdbId}:${seasonKeys[index].seasonNumber}`, result.value] as const]
        : []));
    const bestStillsByKey = new Map(stillResults.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];
      const item = stillTargets[index];
      return [[`${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`, bestEpisodeStill(result.value.stills)] as const];
    }));

    const items = visibleItems.map((item) => {
      const season = seasonsByKey.get(`${item.tmdbId}:${item.seasonNumber}`);
      const episode = season?.episodes?.find((candidate) =>
        candidate.season_number === item.seasonNumber
        && candidate.episode_number === item.episodeNumber);
      const followingSeason = item.followingSeasonNumber != null
        ? seasonsByKey.get(`${item.tmdbId}:${item.followingSeasonNumber}`)
        : undefined;
      const followingEpisode = followingSeason?.episodes?.find((candidate) =>
        candidate.season_number === item.followingSeasonNumber
        && candidate.episode_number === item.followingEpisodeNumber);
      const canonicalStill = landscapeUrl(episode?.still_path);
      const bestStill = bestStillsByKey.get(`${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`) || canonicalStill;
      const currentIsSeasonFinale = isSeasonFinale(season, item.episodeNumber);
      const nextSeasonNumber = currentIsSeasonFinale
        && item.lastSeasonNumber != null
        && item.seasonNumber < item.lastSeasonNumber
          ? item.seasonNumber + 1
          : null;

      return {
        ...item,
        lastActivity: item.lastActivity.toISOString(),
        lastWatchedAt: item.lastWatchedAt?.toISOString() ?? null,
        episodeName: episode?.name || null,
        episodeAirDate: episode?.air_date || null,
        episodeRuntime: episode?.runtime ?? null,
        episodeStill: bestStill,
        episodeStillRanked: stillTargetKeys.has(`${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}`),
        seasonBackdrop: seasonBackdrop(season, item.episodeNumber),
        isNewEpisode: releasedAfterLastWatch(episode?.air_date, item.lastWatchedAt, item.watchedEpisodes),
        isSeasonFinale: currentIsSeasonFinale,
        nextSeasonNumber,
        followingEpisodeName: followingEpisode?.name || null,
        followingEpisodeAirDate: followingEpisode?.air_date || null,
        followingEpisodeRuntime: followingEpisode?.runtime ?? null,
        followingEpisodeStill: landscapeUrl(followingEpisode?.still_path),
      };
    });

    return NextResponse.json({ items, upcoming, upToDate: upToDate.slice(0, 20), summary });
  } catch (error) {
    console.error("[watch-next]", error);
    return NextResponse.json({ error: "Failed to build Watch Next" }, { status: 500 });
  }
}
