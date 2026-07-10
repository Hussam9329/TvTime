import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeMediaMany } from "@/lib/media-normalize";
import { tmdb } from "@/lib/tmdb";
import { getOrCreateUser, parseUserId } from "@/lib/user";

const CATEGORY_VALUES = new Set([
  "all",
  "watchlist",
  "uptodate",
  "finished",
  "finished-anime",
  "upcoming",
  "havent-watched-while",
  "havent-started",
]);
const SORTABLE_FIELDS = new Set(["addedAt", "updatedAt", "userRating", "title", "year", "watchedAt"]);
const ORDERS = new Set(["asc", "desc"]);
const STALE_WATCH_DAYS = 30;
const TMDB_META_TTL_MS = 6 * 60 * 60 * 1000;
const STATUS_REPAIR_CONCURRENCY = 5;

type TvTrackingCategory =
  | "all"
  | "watchlist"
  | "uptodate"
  | "finished"
  | "finished-anime"
  | "upcoming"
  | "havent-watched-while"
  | "havent-started";

type EpisodeMeta = {
  count: number;
  lastWatchedAt: Date | null;
};

type TvMeta = {
  tmdbId: number;
  status: string | null;
  isEnded: boolean;
  inProduction: boolean | null;
  totalEpisodes: number | null;
  totalSeasons: number | null;
  nextEpisode: {
    airDate: string;
    name: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
  } | null;
  fetchedAt: number;
};

type DecoratedShow = any & {
  _serverTrackingStatus: "finished" | "uptodate" | "watchlist";
  _serverIsEnded: boolean;
  _serverTvMeta: TvMeta | null;
};

const tvMetaCache = new Map<number, TvMeta>();

function normalizeStatus(status?: string | null) {
  return String(status || "").trim().toLowerCase();
}

function isEndedTvStatus(status?: string | null) {
  const normalized = normalizeStatus(status);
  // Finished is a strict work-level state. Returning Series / In Production must never be Finished.
  return normalized === "ended" || normalized === "canceled" || normalized === "cancelled";
}

function isFutureDate(date?: string | null) {
  if (!date) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return parsed >= today;
}

function watchedMetaFor(show: any, episodeMetaByShowId: Map<number, EpisodeMeta>): EpisodeMeta {
  const showTmdbId = Number(show.tmdbId || 0);
  return episodeMetaByShowId.get(showTmdbId) ?? { count: 0, lastWatchedAt: null };
}

function daysSince(date: Date | null) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function getTvMeta(tmdbId: number): Promise<TvMeta | null> {
  if (!tmdbId) return null;
  const cached = tvMetaCache.get(tmdbId);
  if (cached && Date.now() - cached.fetchedAt < TMDB_META_TTL_MS) return cached;

  try {
    const detail: any = await tmdb.tvDetail(tmdbId);
    const nextEpisode = detail?.next_episode_to_air;
    const nextAirDate = typeof nextEpisode?.air_date === "string" ? nextEpisode.air_date : null;
    const meta: TvMeta = {
      tmdbId,
      status: typeof detail?.status === "string" ? detail.status : null,
      isEnded: isEndedTvStatus(detail?.status),
      inProduction: typeof detail?.in_production === "boolean" ? detail.in_production : null,
      totalEpisodes: typeof detail?.number_of_episodes === "number" ? detail.number_of_episodes : null,
      totalSeasons: typeof detail?.number_of_seasons === "number" ? detail.number_of_seasons : null,
      nextEpisode: nextAirDate && isFutureDate(nextAirDate)
        ? {
            airDate: nextAirDate,
            name: typeof nextEpisode?.name === "string" ? nextEpisode.name : null,
            seasonNumber: typeof nextEpisode?.season_number === "number" ? nextEpisode.season_number : null,
            episodeNumber: typeof nextEpisode?.episode_number === "number" ? nextEpisode.episode_number : null,
          }
        : null,
      fetchedAt: Date.now(),
    };
    tvMetaCache.set(tmdbId, meta);
    return meta;
  } catch (error) {
    console.warn("[tv-tracking] Failed to refresh TMDB status", tmdbId, error);
    return null;
  }
}

function deriveTrackingStatus(show: any, meta: TvMeta | null, watched: EpisodeMeta): "finished" | "uptodate" | "watchlist" {
  const dbStatus = normalizeStatus(show.status);
  const watchedCount = watched.count;
  const totalEpisodes = meta?.totalEpisodes ?? show.episodes ?? null;
  const hasCompletedKnownEpisodeSet = Boolean(totalEpisodes && watchedCount >= Number(totalEpisodes));
  const isDbCompleted = show.watched === true || dbStatus === "finished" || dbStatus === "watched" || dbStatus === "uptodate";

  // The important rule: a TV show is Finished only when TMDB says the whole work has ended.
  // Local status="finished" or legacy status="watched" is not enough.
  if (meta?.isEnded && (hasCompletedKnownEpisodeSet || isDbCompleted)) return "finished";

  // Ongoing shows can only be Up To Date, never Finished, when the local record says the
  // user has caught up to currently known episodes.
  if (!meta?.isEnded && (isDbCompleted || hasCompletedKnownEpisodeSet)) return "uptodate";

  return "watchlist";
}

async function repairShowIfNeeded(userId: string, show: any, meta: TvMeta | null, watched: EpisodeMeta, status: "finished" | "uptodate" | "watchlist") {
  const update: any = {};
  const dbStatus = normalizeStatus(show.status);

  if (meta) {
    if (meta.totalEpisodes != null && show.episodes !== meta.totalEpisodes) update.episodes = meta.totalEpisodes;
    if (meta.totalSeasons != null && show.seasons !== meta.totalSeasons) update.seasons = meta.totalSeasons;
  }

  if (status === "finished") {
    if (dbStatus !== "finished") update.status = "finished";
    if (!show.watched) update.watched = true;
    if (!show.watchedAt) update.watchedAt = watched.lastWatchedAt ?? new Date();
  } else if (status === "uptodate") {
    // Correct accidental/legacy Finished rows such as FROM: ongoing future season -> Up To Date.
    if (dbStatus !== "uptodate") update.status = "uptodate";
    if (!show.watched) update.watched = true;
    if (!show.watchedAt && watched.lastWatchedAt) update.watchedAt = watched.lastWatchedAt;

    // Rating is locked until the whole show ends. Clear accidental ratings for ongoing shows.
    if (show.userRating != null && meta && !meta.isEnded) update.userRating = null;
  } else {
    if (dbStatus === "finished" || dbStatus === "watched" || dbStatus === "uptodate") update.status = "planned";
    if (show.watched) update.watched = false;
    if (show.watchedAt) update.watchedAt = null;

    // A not-completed TV show should not keep a whole-show rating.
    if (show.userRating != null && meta && !meta.isEnded) update.userRating = null;
  }

  if (Object.keys(update).length === 0) return show;

  try {
    return await db.media.update({ where: { id: show.id }, data: update });
  } catch (error) {
    console.warn("[tv-tracking] Failed to repair tracking row", { userId, mediaId: show.id, tmdbId: show.tmdbId, update, error });
    return show;
  }
}

function sortShows(items: DecoratedShow[], sortBy: string, order: "asc" | "desc") {
  const direction = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];

    if (sortBy === "title") {
      return String(av || "").localeCompare(String(bv || "")) * direction;
    }

    const aTime = av instanceof Date ? av.getTime() : Date.parse(String(av || ""));
    const bTime = bv instanceof Date ? bv.getTime() : Date.parse(String(bv || ""));
    if (!Number.isNaN(aTime) || !Number.isNaN(bTime)) {
      return ((Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime)) * direction;
    }

    const an = typeof av === "number" ? av : Number(av ?? 0);
    const bn = typeof bv === "number" ? bv : Number(bv ?? 0);
    if (!Number.isNaN(an) || !Number.isNaN(bn)) return ((Number.isNaN(an) ? 0 : an) - (Number.isNaN(bn) ? 0 : bn)) * direction;

    return String(av ?? "").localeCompare(String(bv ?? "")) * direction;
  });
}

async function buildTrackingSnapshot(userId: string) {
  const [series, episodeGroups] = await Promise.all([
    db.media.findMany({ where: { userId, type: "series" } }),
    db.watchedEpisode.groupBy({
      by: ["showId"],
      where: { userId },
      _count: { _all: true },
      _max: { watchedAt: true },
    }),
  ]);

  const episodeMetaByShowId = new Map<number, EpisodeMeta>();
  for (const group of episodeGroups) {
    episodeMetaByShowId.set(group.showId, {
      count: group._count._all,
      lastWatchedAt: group._max.watchedAt ?? null,
    });
  }

  const decorated = await mapWithConcurrency(series as any[], STATUS_REPAIR_CONCURRENCY, async (show: any) => {
    const tmdbId = Number(show.tmdbId || 0);
    const meta = tmdbId > 0 ? await getTvMeta(tmdbId) : null;
    const watched = watchedMetaFor(show, episodeMetaByShowId);
    const status = deriveTrackingStatus(show, meta, watched);
    const repaired = await repairShowIfNeeded(userId, show, meta, watched, status);
    return {
      ...repaired,
      _serverTrackingStatus: status,
      _serverIsEnded: Boolean(meta?.isEnded),
      _serverTvMeta: meta,
    } as DecoratedShow;
  });

  const isHaventStarted = (show: DecoratedShow) => watchedMetaFor(show, episodeMetaByShowId).count === 0 && show._serverTrackingStatus === "watchlist";
  const isHaventWatchedWhile = (show: DecoratedShow) => {
    if (show._serverTrackingStatus !== "watchlist") return false;
    const meta = watchedMetaFor(show, episodeMetaByShowId);
    const since = daysSince(meta.lastWatchedAt);
    return meta.count > 0 && since != null && since >= STALE_WATCH_DAYS;
  };
  const isUpcoming = (show: DecoratedShow) => Boolean(show._serverTvMeta?.nextEpisode);

  const counts = {
    all: decorated.length,
    watchlist: decorated.filter((show) => show._serverTrackingStatus === "watchlist").length,
    uptodate: decorated.filter((show) => show._serverTrackingStatus === "uptodate").length,
    finished: decorated.filter((show) => show._serverTrackingStatus === "finished" && !show.isAnime).length,
    finishedAnime: decorated.filter((show) => show._serverTrackingStatus === "finished" && show.isAnime).length,
    upcoming: decorated.filter(isUpcoming).length,
    haventWatched: decorated.filter(isHaventWatchedWhile).length,
    haventStarted: decorated.filter(isHaventStarted).length,
  };

  return {
    decorated,
    episodeMetaByShowId,
    counts,
    predicates: {
      isHaventStarted,
      isHaventWatchedWhile,
      isUpcoming,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const rawCategory = url.searchParams.get("category") || "all";
    const category = (CATEGORY_VALUES.has(rawCategory) ? rawCategory : "all") as TvTrackingCategory;
    const search = url.searchParams.get("search")?.trim().toLowerCase() || "";
    const sortByParam = url.searchParams.get("sortBy") || "title";
    const orderParam = url.searchParams.get("order") || "asc";
    const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "title";
    const order = (ORDERS.has(orderParam) ? orderParam : "asc") as "asc" | "desc";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const countsOnly = url.searchParams.get("countsOnly") === "true";

    const snapshot = await buildTrackingSnapshot(user.id);

    if (countsOnly) {
      return NextResponse.json({
        counts: snapshot.counts,
        countsAreGlobal: true,
        repairedOnRead: true,
      });
    }

    const filteredBySearch = search
      ? snapshot.decorated.filter((show) => String(show.title || "").toLowerCase().includes(search))
      : snapshot.decorated;

    const categoryPredicates: Record<TvTrackingCategory, (show: DecoratedShow) => boolean> = {
      all: () => true,
      watchlist: (show) => show._serverTrackingStatus === "watchlist",
      uptodate: (show) => show._serverTrackingStatus === "uptodate",
      finished: (show) => show._serverTrackingStatus === "finished" && !show.isAnime,
      "finished-anime": (show) => show._serverTrackingStatus === "finished" && show.isAnime,
      upcoming: snapshot.predicates.isUpcoming,
      "havent-watched-while": snapshot.predicates.isHaventWatchedWhile,
      "havent-started": snapshot.predicates.isHaventStarted,
    };

    const matching = sortShows(filteredBySearch.filter(categoryPredicates[category]), sortBy, order);
    const pageItems = matching.slice(offset, offset + limit).map((show) => {
      const meta = watchedMetaFor(show, snapshot.episodeMetaByShowId);
      const nextEpisode = show._serverTvMeta?.nextEpisode ?? null;
      const { _serverTvMeta, _serverTrackingStatus, _serverIsEnded, ...publicShow } = show;
      return {
        ...publicShow,
        status: _serverTrackingStatus === "watchlist" ? show.status : _serverTrackingStatus,
        _trackingStatus: _serverTrackingStatus,
        _isEndedByTmdb: _serverIsEnded,
        _tmdbStatus: _serverTvMeta?.status ?? null,
        _watchedEpisodeCount: meta.count,
        _lastWatchedAt: meta.lastWatchedAt,
        _daysSinceLastWatch: daysSince(meta.lastWatchedAt),
        _nextEpisodeAirDate: nextEpisode?.airDate ?? null,
        _nextEpisodeName: nextEpisode?.name ?? null,
        _nextEpisodeSeasonNumber: nextEpisode?.seasonNumber ?? null,
        _nextEpisodeNumber: nextEpisode?.episodeNumber ?? null,
      };
    });

    return NextResponse.json({
      items: normalizeMediaMany(pageItems),
      total: matching.length,
      limit,
      offset,
      category,
      counts: snapshot.counts,
      countsAreGlobal: true,
      repairedOnRead: true,
    });
  } catch (error) {
    console.error("[tv-tracking]", error);
    return NextResponse.json({ error: "Failed to load TV tracking" }, { status: 500 });
  }
}
