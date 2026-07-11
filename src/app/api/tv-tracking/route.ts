import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeMediaMany } from "@/lib/media-normalize";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import {
  deriveTvTrackingState,
  episodeKey,
  normalizeTvTrackingState,
  tvStateToMediaPatch,
  type TvTrackingState,
} from "@/lib/tv-status-engine";
import { getTvStatusMetadata, type TvStatusMetadata } from "@/lib/tv-status-server";
import { materializeLegacyCompletionSnapshot } from "@/lib/tv-status-repair";

const CATEGORY_VALUES = new Set([
  "all",
  "watchlist",
  "uptodate",
  "finished",
  "finished-anime",
  "upcoming",
  "havent-watched",
  "havent-started",
]);
const LEGACY_CATEGORY_ALIASES: Record<string, TvTrackingCategory> = {
  planned: "watchlist",
  "not-started": "havent-started",
  watching: "havent-watched",
  "havent-watched-while": "havent-watched",
};
const SORTABLE_FIELDS = new Set(["addedAt", "updatedAt", "userRating", "title", "year", "watchedAt"]);
const ORDERS = new Set(["asc", "desc"]);
const STALE_WATCH_DAYS = 30;
const STATUS_REPAIR_CONCURRENCY = 5;

type TvTrackingCategory =
  | "all"
  | "watchlist"
  | "uptodate"
  | "finished"
  | "finished-anime"
  | "upcoming"
  | "havent-watched"
  | "havent-started";

type WatchedEpisodeMeta = {
  keys: Set<string>;
  count: number;
  lastWatchedAt: Date | null;
};

type DecoratedShow = any & {
  _serverTrackingStatus: TvTrackingState;
  _serverTvMeta: TvStatusMetadata | null;
  _serverWatchedMeta: WatchedEpisodeMeta;
  _serverAiredEpisodeCount: number | null;
  _serverWatchedAiredEpisodeCount: number;
  _serverIgnoredFutureCount: number;
  _serverLegacyCompletionAssumed: boolean;
  _serverLegacySnapshotMaterialized: boolean;
  _serverVerified: boolean;
};

function emptyWatchedMeta(): WatchedEpisodeMeta {
  return { keys: new Set(), count: 0, lastWatchedAt: null };
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

function sortShows(items: DecoratedShow[], sortBy: string, order: "asc" | "desc") {
  const direction = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];
    if (sortBy === "title") return String(av || "").localeCompare(String(bv || "")) * direction;

    const aTime = av instanceof Date ? av.getTime() : Date.parse(String(av || ""));
    const bTime = bv instanceof Date ? bv.getTime() : Date.parse(String(bv || ""));
    if (!Number.isNaN(aTime) || !Number.isNaN(bTime)) {
      return ((Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime)) * direction;
    }

    const an = typeof av === "number" ? av : Number(av ?? 0);
    const bn = typeof bv === "number" ? bv : Number(bv ?? 0);
    if (!Number.isNaN(an) || !Number.isNaN(bn)) {
      return ((Number.isNaN(an) ? 0 : an) - (Number.isNaN(bn) ? 0 : bn)) * direction;
    }
    return String(av ?? "").localeCompare(String(bv ?? "")) * direction;
  });
}

// TVM-27: GET handlers must NOT write to the database. This function now
// applies the derived state patch IN MEMORY only (for display), without
// persisting to DB. A separate sync endpoint can persist repairs if needed.
async function repairShowIfNeeded(
  show: any,
  state: TvTrackingState,
  metadata: TvStatusMetadata | null,
  lastWatchedAt: Date | null,
  stateVerified: boolean,
) {
  const patch = tvStateToMediaPatch(state, lastWatchedAt ?? show.watchedAt);

  // Apply patch in-memory only — no db.media.update during GET
  const patched: any = { ...show };

  if (stateVerified) {
    if (show.status !== patch.status) patched.status = patch.status;
    if (show.watched !== patch.watched) patched.watched = patch.watched;
    const currentWatchedAt = show.watchedAt ? new Date(show.watchedAt).getTime() : null;
    const targetWatchedAt = patch.watchedAt ? patch.watchedAt.getTime() : null;
    if (currentWatchedAt !== targetWatchedAt) patched.watchedAt = patch.watchedAt;
  }

  if (metadata) {
    if (metadata.totalEpisodes != null && show.episodes !== metadata.totalEpisodes) patched.episodes = metadata.totalEpisodes;
    if (metadata.totalSeasons != null && show.seasons !== metadata.totalSeasons) patched.seasons = metadata.totalSeasons;
  }

  // userRating is deliberately absent: tracking state can never add, clear or
  // otherwise mutate a rating.
  return patched;
}

async function buildTrackingSnapshot(userId: string) {
  const watchedRows = await db.watchedEpisode.findMany({
    where: { userId },
    select: { showId: true, seasonNumber: true, episodeNumber: true, watchedAt: true },
    orderBy: { watchedAt: "desc" },
  });
  const showIdsWithEpisodeProgress = [...new Set(watchedRows.map((row) => row.showId))];
  const series = await db.media.findMany({
    where: {
      userId,
      type: "series",
      isAnime: false,
      OR: [
        { status: { not: null } },
        { watched: true },
        ...(showIdsWithEpisodeProgress.length > 0
          ? [{ tmdbId: { in: showIdsWithEpisodeProgress } }]
          : []),
      ],
    },
  });

  const watchedByShow = new Map<number, WatchedEpisodeMeta>();
  for (const row of watchedRows) {
    const meta = watchedByShow.get(row.showId) ?? emptyWatchedMeta();
    meta.keys.add(episodeKey(row.seasonNumber, row.episodeNumber));
    meta.count = meta.keys.size;
    if (!meta.lastWatchedAt || row.watchedAt > meta.lastWatchedAt) meta.lastWatchedAt = row.watchedAt;
    watchedByShow.set(row.showId, meta);
  }

  const decorated = await mapWithConcurrency(series as any[], STATUS_REPAIR_CONCURRENCY, async (show: any) => {
    const tmdbId = Number(show.tmdbId || 0);
    const watched = watchedByShow.get(tmdbId) ?? emptyWatchedMeta();
    let metadata: TvStatusMetadata | null = null;
    let legacySnapshotMaterialized = false;
    if (tmdbId > 0) {
      try {
        metadata = await getTvStatusMetadata(tmdbId);
      } catch (error) {
        console.warn("[tv-tracking] Unable to verify TV metadata", tmdbId, error);
      }
    }

    if (metadata && watched.count === 0) {
      const snapshot = await materializeLegacyCompletionSnapshot({
        media: show,
        existingEpisodeCount: watched.count,
        metadata,
      });
      if (snapshot.verified && snapshot.episodes.length > 0) {
        legacySnapshotMaterialized = snapshot.materialized;
        for (const episode of snapshot.episodes) {
          watched.keys.add(episodeKey(episode.seasonNumber, episode.episodeNumber));
        }
        watched.count = watched.keys.size;
        watched.lastWatchedAt = snapshot.completionAt;
        watchedByShow.set(tmdbId, watched);
      }
    }

    const persisted = normalizeTvTrackingState(show.status);
    const legacyCompleted = watched.count === 0 && Boolean(
      show.watched || persisted === "finished" || persisted === "uptodate",
    );
    const derived = deriveTvTrackingState({
      persistedStatus: show.status,
      officiallyEnded: metadata ? metadata.officiallyEnded : null,
      airedEpisodeCount: metadata?.airedEpisodeCount ?? null,
      airedEpisodeKeys: metadata?.airedEpisodeKeys,
      watchedEpisodeKeys: watched.keys,
      legacyCompleted,
    });

    const effectiveState = derived.verified
      ? derived.state
      : (persisted ?? (watched.count > 0 ? "watching" : "not_started"));
    const repaired = await repairShowIfNeeded(
      show,
      effectiveState,
      metadata,
      watched.lastWatchedAt,
      derived.verified,
    );
    return {
      ...repaired,
      _serverTrackingStatus: effectiveState,
      _serverTvMeta: metadata,
      _serverWatchedMeta: watched,
      _serverAiredEpisodeCount: derived.airedEpisodeCount,
      _serverWatchedAiredEpisodeCount: derived.watchedAiredEpisodeCount,
      _serverIgnoredFutureCount: derived.futureOrUnknownWatchedEpisodeCount,
      _serverLegacyCompletionAssumed: derived.legacyCompletionAssumed,
      _serverLegacySnapshotMaterialized: legacySnapshotMaterialized,
      _serverVerified: derived.verified,
    } as DecoratedShow;
  });

  const hasUnwatchedReleasedEpisode = (show: DecoratedShow) => {
    if (show._serverTrackingStatus !== "watching") return false;
    const aired = show._serverAiredEpisodeCount;
    return aired != null && aired > show._serverWatchedAiredEpisodeCount;
  };
  const isStaleWatching = (show: DecoratedShow) => {
    if (!hasUnwatchedReleasedEpisode(show)) return false;
    const since = daysSince(show._serverWatchedMeta.lastWatchedAt);
    return since != null && since >= STALE_WATCH_DAYS;
  };
  const isUpcoming = (show: DecoratedShow) => Boolean(show._serverTvMeta?.nextEpisode);

  const counts = {
    all: decorated.length,
    planned: decorated.filter((show) => show._serverTrackingStatus === "planned").length,
    watchlist: decorated.filter((show) => show._serverTrackingStatus === "planned").length,
    notStarted: decorated.filter((show) => show._serverTrackingStatus === "not_started").length,
    haventStarted: decorated.filter((show) => show._serverTrackingStatus === "not_started").length,
    watching: decorated.filter((show) => show._serverTrackingStatus === "watching").length,
    uptodate: decorated.filter((show) => show._serverTrackingStatus === "uptodate").length,
    finished: decorated.filter((show) => show._serverTrackingStatus === "finished" && !show.isAnime).length,
    finishedAnime: decorated.filter((show) => show._serverTrackingStatus === "finished" && show.isAnime).length,
    upcoming: decorated.filter(isUpcoming).length,
    haventWatched: decorated.filter(hasUnwatchedReleasedEpisode).length,
  };

  return { decorated, counts, predicates: { hasUnwatchedReleasedEpisode, isStaleWatching, isUpcoming } };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const rawCategory = url.searchParams.get("category") || "all";
    const aliasedCategory = LEGACY_CATEGORY_ALIASES[rawCategory] || rawCategory;
    const category = (CATEGORY_VALUES.has(aliasedCategory) ? aliasedCategory : "all") as TvTrackingCategory;
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
      return NextResponse.json({ counts: snapshot.counts, countsAreGlobal: true, repairedOnRead: false });
    }

    const filteredBySearch = search
      ? snapshot.decorated.filter((show) => String(show.title || "").toLowerCase().includes(search))
      : snapshot.decorated;

    const categoryPredicates: Record<TvTrackingCategory, (show: DecoratedShow) => boolean> = {
      all: () => true,
      watchlist: (show) => show._serverTrackingStatus === "planned",
      uptodate: (show) => show._serverTrackingStatus === "uptodate",
      finished: (show) => show._serverTrackingStatus === "finished" && !show.isAnime,
      "finished-anime": (show) => show._serverTrackingStatus === "finished" && show.isAnime,
      upcoming: snapshot.predicates.isUpcoming,
      "havent-watched": snapshot.predicates.hasUnwatchedReleasedEpisode,
      "havent-started": (show) => show._serverTrackingStatus === "not_started",
    };

    const matching = sortShows(filteredBySearch.filter(categoryPredicates[category]), sortBy, order);
    const pageItems = matching.slice(offset, offset + limit).map((show) => {
      const nextEpisode = show._serverTvMeta?.nextEpisode ?? null;
      const {
        _serverTvMeta,
        _serverTrackingStatus,
        _serverWatchedMeta,
        _serverAiredEpisodeCount,
        _serverWatchedAiredEpisodeCount,
        _serverIgnoredFutureCount,
        _serverLegacyCompletionAssumed,
        _serverLegacySnapshotMaterialized,
        _serverVerified,
        ...publicShow
      } = show;
      return {
        ...publicShow,
        status: _serverTrackingStatus,
        _trackingStatus: _serverTrackingStatus,
        _isEndedByTmdb: _serverTvMeta?.officiallyEnded ?? null,
        _tmdbStatus: _serverTvMeta?.tmdbStatus ?? null,
        _watchedEpisodeCount: _serverWatchedMeta.count,
        _watchedAiredEpisodeCount: _serverWatchedAiredEpisodeCount,
        _airedEpisodeCount: _serverAiredEpisodeCount,
        _ignoredFutureEpisodeCount: _serverIgnoredFutureCount,
        _legacyCompletionAssumed: _serverLegacyCompletionAssumed,
        _legacySnapshotMaterialized: _serverLegacySnapshotMaterialized,
        _stateVerified: _serverVerified,
        _lastWatchedAt: _serverWatchedMeta.lastWatchedAt,
        _daysSinceLastWatch: daysSince(_serverWatchedMeta.lastWatchedAt),
        _hasUnwatchedReleasedEpisode: _serverAiredEpisodeCount != null
          && _serverAiredEpisodeCount > _serverWatchedAiredEpisodeCount,
        _isStaleWatching: snapshot.predicates.isStaleWatching(show),
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
      repairedOnRead: false,
    });
  } catch (error) {
    console.error("[tv-tracking]", error);
    return NextResponse.json({ error: "Failed to load TV tracking" }, { status: 500 });
  }
}
