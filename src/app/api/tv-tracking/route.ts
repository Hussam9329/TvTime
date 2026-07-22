import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeMediaMany } from "@/lib/media-normalize";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import {
  deriveTvTrackingState,
  episodeKey,
  normalizeTvTrackingState,
  tvStateToMediaPatch,
  type TvTrackingState,
} from "@/lib/tv-status-engine";
import { getTvStatusMetadata, batchReadDbMetadata, type TvStatusMetadata } from "@/lib/tv-status-server";
import { materializeLegacyCompletionSnapshot } from "@/lib/tv-status-repair";
import { buildFastTvTrackingSummary, type FastTvTrackingRow } from "@/lib/tv-tracking-counts";

const CATEGORY_VALUES = new Set([
  "all",
  "watchlist",
  "uptodate",
  "finished",
  "upcoming",
  "havent-watched",
  "havent-started",
  "stale",
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
  | "upcoming"
  | "havent-watched"
  | "havent-started"
  | "stale";

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

type FastTrackingDatabaseRow = {
  tmdbId: number | null;
  status: string | null;
  watched: boolean;
  episodeCount: bigint | number;
  lastWatchedAt: Date | null;
  officiallyEnded: boolean | null;
  airedEpisodeCount: number | null;
  nextEpisodeAirDate: string | null;
  metadataFresh: boolean;
};

/**
 * A single read-only SQL statement powers the header counters. It never reads
 * episode-key arrays, calls TMDB, materializes legacy snapshots or writes cache
 * rows. The full snapshot remains available for list pages that need exact
 * per-episode decoration.
 */
async function buildTrackingCounts(userId: string, world: "standard" | "arabic", now = new Date()) {
  const rows = await db.$queryRaw<FastTrackingDatabaseRow[]>`
    SELECT
      media."tmdbId" AS "tmdbId",
      media."status" AS "status",
      media."watched" AS "watched",
      COALESCE(progress."episodeCount", 0)::bigint AS "episodeCount",
      progress."lastWatchedAt" AS "lastWatchedAt",
      metadata."officiallyEnded" AS "officiallyEnded",
      metadata."airedEpisodeCount" AS "airedEpisodeCount",
      metadata."nextEpisodeAirDate" AS "nextEpisodeAirDate",
      COALESCE(metadata."refreshAfter" > ${now}, FALSE) AS "metadataFresh"
    FROM "Media" AS media
    LEFT JOIN (
      SELECT
        "showId",
        COUNT(*)::bigint AS "episodeCount",
        MAX("watchedAt") AS "lastWatchedAt"
      FROM "WatchedEpisode"
      WHERE "userId" = ${userId}
      GROUP BY "showId"
    ) AS progress ON progress."showId" = media."tmdbId"
    LEFT JOIN "TvMetadataCache" AS metadata ON metadata."tmdbId" = media."tmdbId"
    WHERE media."userId" = ${userId}
      AND media."type" = 'series'
      AND media."isAnime" = FALSE
      AND media."isArabic" = ${world === "arabic"}
      AND (media."status" IS NOT NULL OR media."watched" = TRUE OR COALESCE(progress."episodeCount", 0) > 0)
  `;

  return buildFastTvTrackingSummary(rows.map((row): FastTvTrackingRow => ({
    ...row,
    episodeCount: Number(row.episodeCount),
  })), now);
}

async function buildTrackingSnapshot(userId: string, world: "standard" | "arabic") {
  const now = new Date();

  // ── GROUP WATCHED EPISODES AT THE DB LEVEL ───────────────────────────
  // Two-stage aggregation for the full list path:
  // 1. Per-show COUNT(*) + MAX(watchedAt) avoids array serialization.
  // 2. Per-show episode keys are loaded only for shows with progress. The
  //    query returns (showId, seasonNumber, episodeNumber), and the Set is
  //    assembled in JavaScript instead of serializing ARRAY_AGG values.
  // The independent countsOnly fast path returns before this function and
  // uses one compact SQL statement without TMDB or episode-key loading.
  const watchedCounts = await db.$queryRaw<
    Array<{ showId: number; episodeCount: bigint; lastWatchedAt: Date | null }>
  >`
    SELECT
      "showId",
      COUNT(*)::bigint AS "episodeCount",
      MAX("watchedAt") AS "lastWatchedAt"
    FROM "WatchedEpisode"
    WHERE "userId" = ${userId}
    GROUP BY "showId"
  `;

  const watchedByShow = new Map<number, WatchedEpisodeMeta>();
  const showIdsWithEpisodeProgress: number[] = [];
  for (const row of watchedCounts) {
    const showId = Number(row.showId);
    watchedByShow.set(showId, {
      keys: new Set<string>(),
      count: Number(row.episodeCount),
      lastWatchedAt: row.lastWatchedAt ?? null,
    });
    showIdsWithEpisodeProgress.push(showId);
  }

  const series = await db.media.findMany({
    where: {
      userId,
      type: "series",
      isAnime: false,
      isArabic: world === "arabic",
      OR: [
        { status: { not: null } },
        { watched: true },
        ...(showIdsWithEpisodeProgress.length > 0
          ? [{ tmdbId: { in: showIdsWithEpisodeProgress } }]
          : []),
      ],
    },
  });

  // ── BATCH METADATA READ ───────────────────────────────────────────────
  // Pre-fetch ALL TV metadata for ALL tracked shows in a single DB round-trip.
  // This is the critical optimization: instead of N=597 individual findUnique
  // calls inside the loop below (each ~5ms = 3s total), we do ONE findMany
  // with `tmdbId IN (...)` that returns all rows in ~20ms.
  //
  // Rows that are missing or stale are NOT in this map — the loop falls back
  // to getTvStatusMetadata() for those, which lazily fetches from TMDB and
  // populates the cache for next time.
  const trackedTmdbIds = series
    .map((s: any) => Number(s.tmdbId))
    .filter((id: number) => Number.isFinite(id) && id > 0);
  const showsNeedingKeys = trackedTmdbIds.filter((id) => {
    const watched = watchedByShow.get(id);
    return watched && watched.count > 0;
  });
  const metadataByTmdbId = await batchReadDbMetadata(trackedTmdbIds, now, {
    // Exact aired keys are required only for shows that have progress. Without
    // them an ongoing cached show cannot prove the watched/air-date boundary.
    episodeKeysForTmdbIds: showsNeedingKeys,
  });

  // ── FETCH WATCHED EPISODE KEYS ONLY FOR SHOWS THAT NEED THEM ─────────
  // The state-derivation engine needs the actual episode keys (Set<string>)
  // to compute "watching" vs "uptodate" vs "finished". But it does NOT need
  // them for shows with zero watched episodes — those get an empty Set.
  // So we only fetch keys for shows that have at least one watched episode.
  //
  // This keeps the heavy query off the fast path (countsOnly=true) entirely,
  // and limits it on the full path to ~466 shows × ~72 episodes = ~34k rows
  // — but as raw tuples, not arrays, so serialization is 5x faster.
  if (showsNeedingKeys.length > 0) {
    const keyRows = await db.$queryRaw<
      Array<{ showId: number; seasonNumber: number; episodeNumber: number }>
    >`
      SELECT "showId", "seasonNumber", "episodeNumber"
      FROM "WatchedEpisode"
      WHERE "userId" = ${userId} AND "showId" IN (${Prisma.join(showsNeedingKeys)})
    `;
    for (const row of keyRows) {
      const showId = Number(row.showId);
      const meta = watchedByShow.get(showId);
      if (meta) {
        meta.keys.add(`${row.seasonNumber}-${row.episodeNumber}`);
      }
    }
  }

  const decorated = await mapWithConcurrency(series as any[], STATUS_REPAIR_CONCURRENCY, async (show: any) => {
    const tmdbId = Number(show.tmdbId || 0);
    const watched = watchedByShow.get(tmdbId) ?? emptyWatchedMeta();
    let metadata: TvStatusMetadata | null = null;
    let legacySnapshotMaterialized = false;

    if (tmdbId > 0) {
      // Fast path: metadata was pre-fetched by the batch query above.
      metadata = metadataByTmdbId.get(tmdbId) ?? null;
      if (!metadata) {
        // Slow path: row missing or stale. Lazily fetch from TMDB and
        // populate the cache for next time.
        try {
          metadata = await getTvStatusMetadata(tmdbId, now);
        } catch (error) {
          console.warn("[tv-tracking] Unable to verify TV metadata", tmdbId, error);
        }
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
      : watched.count > 0
        ? "watching"
        : persisted === "planned"
          ? "planned"
          : "not_started";
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
    finished: decorated.filter((show) => show._serverTrackingStatus === "finished").length,
    upcoming: decorated.filter(isUpcoming).length,
    haventWatched: decorated.filter(hasUnwatchedReleasedEpisode).length,
    stale: decorated.filter(isStaleWatching).length,
  };

  return { decorated, counts, predicates: { hasUnwatchedReleasedEpisode, isStaleWatching, isUpcoming } };
}

export async function GET(req: NextRequest) {
  try {
    const requestUserId = await resolveUserId(req);
    const url = new URL(req.url);
    const rawCategory = url.searchParams.get("category") || "all";
    const aliasedCategory = LEGACY_CATEGORY_ALIASES[rawCategory] || rawCategory;
    if (!CATEGORY_VALUES.has(aliasedCategory)) {
      return NextResponse.json(
        {
          error: `Unsupported TV tracking category: ${rawCategory}`,
          code: "INVALID_TV_TRACKING_CATEGORY",
          allowedCategories: [...CATEGORY_VALUES],
        },
        { status: 400 },
      );
    }
    const category = aliasedCategory as TvTrackingCategory;
    const search = url.searchParams.get("search")?.trim().toLowerCase() || "";
    const sortByParam = url.searchParams.get("sortBy") || "title";
    const orderParam = url.searchParams.get("order") || "asc";
    const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "title";
    const order = (ORDERS.has(orderParam) ? orderParam : "asc") as "asc" | "desc";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const countsOnly = url.searchParams.get("countsOnly") === "true";
    const worldParam = url.searchParams.get("world") || "standard";
    if (worldParam !== "standard" && worldParam !== "arabic") {
      return NextResponse.json({ error: "Unsupported TV tracking world", code: "INVALID_TV_TRACKING_WORLD" }, { status: 400 });
    }
    const world = worldParam as "standard" | "arabic";

    if (countsOnly) {
      const summary = await buildTrackingCounts(requestUserId, world);
      const response = NextResponse.json({
        counts: summary.counts,
        countsAreGlobal: true,
        repairedOnRead: false,
        world,
        fastPath: true,
        countsSource: "persisted-state-plus-aggregate-progress",
        dbQueryBudget: 1,
        freshMetadataRows: summary.freshMetadataRows,
        unverifiedProgressRows: summary.unverifiedProgressRows,
      });
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-TvTime-Counts-Path", "fast");
      response.headers.set("X-TvTime-DB-Query-Budget", "1");
      return response;
    }

    const user = await getOrCreateUser(requestUserId);
    const snapshot = await buildTrackingSnapshot(user.id, world);

    const filteredBySearch = search
      ? snapshot.decorated.filter((show) => String(show.title || "").toLowerCase().includes(search))
      : snapshot.decorated;

    const categoryPredicates: Record<TvTrackingCategory, (show: DecoratedShow) => boolean> = {
      all: () => true,
      watchlist: (show) => show._serverTrackingStatus === "planned",
      uptodate: (show) => show._serverTrackingStatus === "uptodate",
      finished: (show) => show._serverTrackingStatus === "finished",
      upcoming: snapshot.predicates.isUpcoming,
      "havent-watched": snapshot.predicates.hasUnwatchedReleasedEpisode,
      "havent-started": (show) => show._serverTrackingStatus === "not_started",
      stale: snapshot.predicates.isStaleWatching,
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
      world,
    });
  } catch (error) {
    console.error("[tv-tracking]", error);
    return NextResponse.json({ error: "Failed to load TV tracking" }, { status: 500 });
  }
}
