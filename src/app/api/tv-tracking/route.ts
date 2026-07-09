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
const FINISHED_STATUSES = new Set(["finished", "watched"]);
const STALE_WATCH_DAYS = 30;

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

type UpcomingMeta = {
  airDate: string;
  name: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
};

function normalizeStatus(status?: string | null) {
  return String(status || "").toLowerCase();
}

function trackingStatusFor(show: any): "finished" | "uptodate" | "watchlist" {
  const status = normalizeStatus(show.status);
  if (FINISHED_STATUSES.has(status)) return "finished";
  if (status === "uptodate") return "uptodate";
  return "watchlist";
}

function isFinished(show: any) {
  return trackingStatusFor(show) === "finished";
}

function isUpToDate(show: any) {
  return trackingStatusFor(show) === "uptodate";
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

async function getUpcomingMeta(shows: any[]) {
  const meta = new Map<string, UpcomingMeta>();
  const candidates = shows.filter((show) => Number(show.tmdbId || 0) > 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await mapWithConcurrency(candidates, 6, async (show) => {
    try {
      const detail: any = await tmdb.tvDetail(Number(show.tmdbId));
      const nextEpisode = detail?.next_episode_to_air;
      const airDateRaw = nextEpisode?.air_date;
      if (!airDateRaw) return;

      const airDate = new Date(`${airDateRaw}T00:00:00Z`);
      if (Number.isNaN(airDate.getTime()) || airDate < today) return;

      meta.set(show.id, {
        airDate: airDateRaw,
        name: typeof nextEpisode?.name === "string" ? nextEpisode.name : null,
        seasonNumber: typeof nextEpisode?.season_number === "number" ? nextEpisode.season_number : null,
        episodeNumber: typeof nextEpisode?.episode_number === "number" ? nextEpisode.episode_number : null,
      });
    } catch (error) {
      // TMDB can fail for an individual title. Do not fail the whole tracking page.
      console.warn("[tv-tracking] Failed to refresh upcoming metadata", show.tmdbId, error);
    }
  });

  return meta;
}

function sortShows(items: any[], sortBy: string, order: "asc" | "desc") {
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

    const [series, episodeGroups] = await Promise.all([
      db.media.findMany({ where: { userId: user.id, type: "series" } }),
      db.watchedEpisode.groupBy({
        by: ["showId"],
        where: { userId: user.id },
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

    // Upcoming needs current TMDB data because the local DB does not persist next_episode_to_air.
    // The route still keeps the page stable if one title fails to refresh.
    const upcomingMetaByMediaId = await getUpcomingMeta(series);

    const filteredBySearch = search
      ? series.filter((show) => String(show.title || "").toLowerCase().includes(search))
      : series;

    const isHaventStarted = (show: any) => watchedMetaFor(show, episodeMetaByShowId).count === 0 && !isFinished(show) && !isUpToDate(show);
    const isHaventWatchedWhile = (show: any) => {
      if (isFinished(show) || isUpToDate(show)) return false;
      const meta = watchedMetaFor(show, episodeMetaByShowId);
      const since = daysSince(meta.lastWatchedAt);
      return meta.count > 0 && since != null && since >= STALE_WATCH_DAYS;
    };
    const isUpcoming = (show: any) => upcomingMetaByMediaId.has(show.id);
    const isWatchlist = (show: any) => trackingStatusFor(show) === "watchlist";

    const counts = {
      all: series.length,
      watchlist: series.filter(isWatchlist).length,
      uptodate: series.filter(isUpToDate).length,
      finished: series.filter((show) => isFinished(show) && !show.isAnime).length,
      finishedAnime: series.filter((show) => isFinished(show) && show.isAnime).length,
      upcoming: series.filter(isUpcoming).length,
      haventWatched: series.filter(isHaventWatchedWhile).length,
      haventStarted: series.filter(isHaventStarted).length,
    };

    const categoryPredicates: Record<TvTrackingCategory, (show: any) => boolean> = {
      all: () => true,
      watchlist: isWatchlist,
      uptodate: isUpToDate,
      finished: (show) => isFinished(show) && !show.isAnime,
      "finished-anime": (show) => isFinished(show) && show.isAnime,
      upcoming: isUpcoming,
      "havent-watched-while": isHaventWatchedWhile,
      "havent-started": isHaventStarted,
    };

    const matching = sortShows(filteredBySearch.filter(categoryPredicates[category]), sortBy, order);
    const pageItems = matching.slice(offset, offset + limit).map((show) => {
      const meta = watchedMetaFor(show, episodeMetaByShowId);
      const upcoming = upcomingMetaByMediaId.get(show.id) ?? null;
      return {
        ...show,
        _trackingStatus: trackingStatusFor(show),
        _watchedEpisodeCount: meta.count,
        _lastWatchedAt: meta.lastWatchedAt,
        _daysSinceLastWatch: daysSince(meta.lastWatchedAt),
        _nextEpisodeAirDate: upcoming?.airDate ?? null,
        _nextEpisodeName: upcoming?.name ?? null,
        _nextEpisodeSeasonNumber: upcoming?.seasonNumber ?? null,
        _nextEpisodeNumber: upcoming?.episodeNumber ?? null,
      };
    });

    return NextResponse.json({
      items: normalizeMediaMany(pageItems),
      total: matching.length,
      limit,
      offset,
      category,
      counts,
      countsAreGlobal: true,
    });
  } catch (error) {
    console.error("[tv-tracking]", error);
    return NextResponse.json({ error: "Failed to load TV tracking" }, { status: 500 });
  }
}
