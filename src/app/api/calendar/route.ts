import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tmdb, type Season, type TvDetail } from "@/lib/tmdb";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { addDaysToDateOnly, compareDateOnly, parseDateOnly } from "@/lib/date-only";
import { episodeKey } from "@/lib/tv-status-engine";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 62;
const SHOW_CONCURRENCY = 4;

type FollowedShow = {
  id: string;
  tmdbId: number;
  title: string;
  poster: string | null;
  isAnime: boolean;
};

type CalendarEpisode = {
  id: string;
  date: string;
  showId: number;
  showTitle: string;
  showPoster: string | null;
  showBackdrop: string | null;
  isAnime: boolean;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  overview: string | null;
  stillPath: string | null;
  runtime: number | null;
  watched: boolean;
  trailerKey: string | null;
  networkNames: string[];
};

function rangeDays(from: string, to: string): number | null {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end || from > to) return null;
  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function seasonWindows(detail: TvDetail, from: string, to: string): Season[] {
  const seasons = (detail.seasons || [])
    .filter((season) => season.season_number >= 1 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);

  return seasons.filter((season, index) => {
    const nextStart = seasons.slice(index + 1).find((candidate) => candidate.air_date)?.air_date || null;
    const start = season.air_date;
    const isLastSeason = index === seasons.length - 1;
    const end = nextStart
      ? addDaysToDateOnly(nextStart, -1)
      : isLastSeason && detail.in_production
        ? null
        : detail.last_air_date;

    if (!start) return isLastSeason && detail.in_production;
    if (compareDateOnly(start, to) > 0) return false;
    if (end && compareDateOnly(end, from) < 0) return false;
    return isLastSeason || Boolean(nextStart) || Boolean(end);
  });
}

function trailerKey(detail: TvDetail): string | null {
  const videos = ((detail as TvDetail & { videos?: { results?: Array<{ key?: string; site?: string; type?: string; official?: boolean }> } }).videos?.results || [])
    .filter((video) => video.site === "YouTube" && video.key);
  return videos.find((video) => video.type === "Trailer" && video.official)?.key
    || videos.find((video) => video.type === "Trailer")?.key
    || videos[0]?.key
    || null;
}

async function buildShowSchedule(
  show: FollowedShow,
  from: string,
  to: string,
  watchedKeys: Set<string>,
): Promise<{ episodes: CalendarEpisode[]; warning: string | null }> {
  try {
    const detail = await tmdb.tvDetail(show.tmdbId);
    const seasons = seasonWindows(detail, from, to);
    const details = await mapWithConcurrency(seasons, 3, (season) => tmdb.seasonDetail(show.tmdbId, season.season_number));
    const trailer = trailerKey(detail);
    const networks = (detail.networks || []).map((network) => network.name).filter(Boolean);

    const episodes = details.flatMap((season) => season.episodes || [])
      .filter((episode) => episode.season_number >= 1 && episode.air_date && episode.air_date >= from && episode.air_date <= to)
      .map((episode): CalendarEpisode => ({
        id: `${show.tmdbId}:${episode.season_number}:${episode.episode_number}`,
        date: String(episode.air_date),
        showId: show.tmdbId,
        showTitle: show.title || detail.name || "Untitled show",
        showPoster: show.poster || detail.poster_path || null,
        showBackdrop: detail.backdrop_path || null,
        isAnime: show.isAnime,
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        episodeName: episode.name || `Episode ${episode.episode_number}`,
        overview: episode.overview || null,
        stillPath: episode.still_path || null,
        runtime: episode.runtime ?? null,
        watched: watchedKeys.has(`${show.tmdbId}:${episodeKey(episode.season_number, episode.episode_number)}`),
        trailerKey: trailer,
        networkNames: networks,
      }));

    return { episodes, warning: null };
  } catch (error) {
    console.error("[calendar] Failed to build show schedule", show.tmdbId, error);
    return { episodes: [], warning: show.title };
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const days = rangeDays(from, to);

    if (!days || days > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `A valid from/to range of 1-${MAX_RANGE_DAYS} days is required.` },
        { status: 400 },
      );
    }

    const user = await getOrCreateUser(parseUserId(req));
    const rawShows = await db.media.findMany({
      where: { userId: user.id, type: "series", isFollowing: true, tmdbId: { not: null } },
      orderBy: [{ title: "asc" }, { tmdbId: "asc" }],
      select: {
        id: true,
        tmdbId: true,
        title: true,
        poster: true,
        isAnime: true,
      },
    });

    const shows: FollowedShow[] = rawShows.flatMap((show) => show.tmdbId == null ? [] : [{
      id: show.id,
      tmdbId: show.tmdbId,
      title: show.title,
      poster: show.poster,
      isAnime: show.isAnime,
    }]);

    if (shows.length === 0) {
      return NextResponse.json({
        from,
        to,
        episodes: [],
        shows: [],
        warnings: [],
        partial: false,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const watchedRows = await db.watchedEpisode.findMany({
      where: { userId: user.id, showId: { in: shows.map((show) => show.tmdbId) } },
      select: { showId: true, seasonNumber: true, episodeNumber: true },
    });
    const watchedKeys = new Set<string>(
      watchedRows.map((row: { showId: number; seasonNumber: number; episodeNumber: number }) =>
        `${row.showId}:${episodeKey(row.seasonNumber, row.episodeNumber)}`),
    );

    const results = await mapWithConcurrency(shows, SHOW_CONCURRENCY, (show) =>
      buildShowSchedule(show, from, to, watchedKeys));
    const episodes = results.flatMap((result) => result.episodes)
      .sort((a, b) => a.date.localeCompare(b.date)
        || a.showTitle.localeCompare(b.showTitle)
        || a.seasonNumber - b.seasonNumber
        || a.episodeNumber - b.episodeNumber);
    const warnings = results.map((result) => result.warning).filter((value): value is string => Boolean(value));

    return NextResponse.json({
      from,
      to,
      episodes,
      shows: shows.map((show) => ({
        id: show.id,
        tmdbId: show.tmdbId,
        title: show.title,
        poster: show.poster,
        isAnime: show.isAnime,
      })),
      warnings,
      partial: warnings.length > 0,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[calendar:GET]", error);
    return NextResponse.json({ error: "Failed to load your episode calendar." }, { status: 500 });
  }
}
