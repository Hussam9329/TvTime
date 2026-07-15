import type { Media, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type LegacyLibraryMigrationReport = {
  mode: "applied" | "already-clean" | "unavailable";
  userId: string;
  legacy: {
    watchlist: number;
    watchedMovies: number;
    following: number;
    titleRatings: number;
  };
  canonical: {
    created: number;
    updated: number;
    preservedStrongerState: number;
  };
  cleaned: {
    watchlist: number;
    watchedMovies: number;
    following: number;
    titleRatings: number;
  };
};

type Tx = Prisma.TransactionClient;
type CanonicalType = "movie" | "series";

type WorkingMedia = {
  key: string;
  type: CanonicalType;
  tmdbId: number;
  existing: Media | null;
  current: {
    title: string;
    poster: string | null;
    overview: string | null;
    year: string | null;
    rating: string | null;
    runtime: number | null;
    status: string | null;
    isFollowing: boolean;
    watched: boolean;
    watchedAt: Date | null;
    userRating: number | null;
    ratingStatus: string | null;
    addedAt: Date;
  };
};

const globalMigration = globalThis as unknown as {
  legacyLibraryMigrations?: Map<string, Promise<LegacyLibraryMigrationReport>>;
};

const migrationPromises = globalMigration.legacyLibraryMigrations ?? new Map<string, Promise<LegacyLibraryMigrationReport>>();
globalMigration.legacyLibraryMigrations = migrationPromises;

function canonicalType(mediaType: string): CanonicalType {
  return mediaType === "tv" || mediaType === "series" ? "series" : "movie";
}

function mediaKey(type: CanonicalType, tmdbId: number) {
  return `${type}:${tmdbId}`;
}

function normalizeLegacyRating(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric <= 10 ? numeric * 10 : numeric));
}

function latestDate(a: Date | null, b: Date) {
  return a && a > b ? a : b;
}

function createWorking(type: CanonicalType, tmdbId: number, existing: Media | null, fallbackTitle: string, addedAt: Date): WorkingMedia {
  return {
    key: mediaKey(type, tmdbId),
    type,
    tmdbId,
    existing,
    current: existing
      ? {
          title: existing.title,
          poster: existing.poster,
          overview: existing.overview,
          year: existing.year,
          rating: existing.rating,
          runtime: existing.runtime,
          status: existing.status,
          isFollowing: existing.isFollowing,
          watched: existing.watched,
          watchedAt: existing.watchedAt,
          userRating: existing.userRating,
          ratingStatus: existing.ratingStatus,
          addedAt: existing.addedAt,
        }
      : {
          title: fallbackTitle || "Unknown",
          poster: null,
          overview: null,
          year: null,
          rating: null,
          runtime: null,
          status: null,
          isFollowing: false,
          watched: false,
          watchedAt: null,
          userRating: null,
          ratingStatus: null,
          addedAt,
        },
  };
}

function fillMissing(target: WorkingMedia["current"], incoming: {
  title?: string | null;
  poster?: string | null;
  overview?: string | null;
  year?: string | null;
  rating?: number | string | null;
  runtime?: number | null;
}) {
  if ((!target.title || target.title === "Unknown") && incoming.title) target.title = incoming.title;
  if (!target.poster && incoming.poster) target.poster = incoming.poster;
  if (!target.overview && incoming.overview) target.overview = incoming.overview;
  if (!target.year && incoming.year) target.year = incoming.year;
  if (!target.rating && incoming.rating != null) target.rating = String(incoming.rating);
  if (!target.runtime && incoming.runtime) target.runtime = incoming.runtime;
}

function updatePatch(entry: WorkingMedia): Prisma.MediaUpdateInput {
  const before = entry.existing;
  if (!before) return {};
  const after = entry.current;
  const patch: Prisma.MediaUpdateInput = {};
  if (before.title !== after.title) patch.title = after.title;
  if (before.poster !== after.poster) patch.poster = after.poster;
  if (before.overview !== after.overview) patch.overview = after.overview;
  if (before.year !== after.year) patch.year = after.year;
  if (before.rating !== after.rating) patch.rating = after.rating;
  if (before.runtime !== after.runtime) patch.runtime = after.runtime;
  if (before.status !== after.status) patch.status = after.status;
  if (before.isFollowing !== after.isFollowing) patch.isFollowing = after.isFollowing;
  if (before.watched !== after.watched) patch.watched = after.watched;
  if ((before.watchedAt?.getTime() ?? null) !== (after.watchedAt?.getTime() ?? null)) patch.watchedAt = after.watchedAt;
  if (before.userRating !== after.userRating) patch.userRating = after.userRating;
  if (before.ratingStatus !== after.ratingStatus) patch.ratingStatus = after.ratingStatus;
  return patch;
}

async function migrateInsideTransaction(tx: Tx, userId: string): Promise<LegacyLibraryMigrationReport> {
  // Prevent two serverless cold starts from migrating the same user together.
  // Cast the void return to text so Prisma can deserialize it (Prisma 6.x
  // cannot deserialize PostgreSQL void columns from $queryRaw).
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`tvm10:${userId}`}))::text`;

  const [watchlist, watchedMovies, following, titleRatings] = await Promise.all([
    tx.watchlistItem.findMany({ where: { userId }, orderBy: { addedAt: "asc" } }),
    tx.watchedMovie.findMany({ where: { userId }, orderBy: { watchedAt: "asc" } }),
    tx.followingShow.findMany({ where: { userId }, orderBy: { followedAt: "asc" } }),
    tx.rating.findMany({ where: { userId, mediaType: { in: ["movie", "tv", "series"] } }, orderBy: { updatedAt: "asc" } }),
  ]);

  const report: LegacyLibraryMigrationReport = {
    mode: "applied",
    userId,
    legacy: {
      watchlist: watchlist.length,
      watchedMovies: watchedMovies.length,
      following: following.length,
      titleRatings: titleRatings.length,
    },
    canonical: { created: 0, updated: 0, preservedStrongerState: 0 },
    cleaned: { watchlist: 0, watchedMovies: 0, following: 0, titleRatings: 0 },
  };

  if (watchlist.length + watchedMovies.length + following.length + titleRatings.length === 0) {
    report.mode = "already-clean";
    return report;
  }

  const idsByType = new Map<CanonicalType, Set<number>>([
    ["movie", new Set<number>()],
    ["series", new Set<number>()],
  ]);
  for (const item of watchlist) idsByType.get(canonicalType(item.mediaType))!.add(Number(item.tmdbId));
  for (const item of watchedMovies) idsByType.get("movie")!.add(Number(item.tmdbId));
  for (const item of following) idsByType.get("series")!.add(Number(item.tmdbId));
  for (const item of titleRatings) idsByType.get(canonicalType(item.mediaType))!.add(Number(item.tmdbId));

  const impactedIds = [...new Set([...idsByType.get("movie")!, ...idsByType.get("series")!])];
  const existingMedia: Media[] = impactedIds.length
    ? await tx.media.findMany({ where: { userId, tmdbId: { in: impactedIds }, type: { in: ["movie", "series"] } } })
    : [];
  const existingByKey = new Map<string, Media>(
    existingMedia.map((item) => [mediaKey(item.type as CanonicalType, Number(item.tmdbId)), item]),
  );
  const working = new Map<string, WorkingMedia>();

  const getEntry = (type: CanonicalType, tmdbId: number, title: string, addedAt: Date) => {
    const key = mediaKey(type, tmdbId);
    let entry = working.get(key);
    if (!entry) {
      entry = createWorking(type, tmdbId, existingByKey.get(key) ?? null, title, addedAt);
      working.set(key, entry);
    }
    return entry;
  };

  // State precedence: Watchlist < Following < actual movie watched. Ratings are
  // orthogonal and never change state.
  for (const legacy of watchlist) {
    const type = canonicalType(legacy.mediaType);
    const entry = getEntry(type, Number(legacy.tmdbId), legacy.title, legacy.addedAt);
    fillMissing(entry.current, {
      title: legacy.title,
      poster: legacy.posterPath,
      overview: legacy.overview,
      year: legacy.releaseDate ? legacy.releaseDate.slice(0, 4) : null,
      rating: legacy.voteAverage,
    });
    const stronger = entry.current.watched || (entry.current.status != null && entry.current.status !== "planned");
    if (stronger) report.canonical.preservedStrongerState++;
    else entry.current.status = "planned";
  }

  for (const legacy of following) {
    const entry = getEntry("series", Number(legacy.tmdbId), legacy.title, legacy.followedAt);
    fillMissing(entry.current, { title: legacy.title, poster: legacy.posterPath });
    const stronger = entry.current.watched || (entry.current.status != null && entry.current.status !== "planned" && entry.current.status !== "not_started");
    if (stronger) report.canonical.preservedStrongerState++;
    else entry.current.status = "not_started";
    entry.current.isFollowing = true;
  }

  for (const legacy of watchedMovies) {
    const entry = getEntry("movie", Number(legacy.tmdbId), legacy.title, legacy.watchedAt);
    fillMissing(entry.current, { title: legacy.title, poster: legacy.posterPath, runtime: legacy.runtime });
    entry.current.watched = true;
    entry.current.watchedAt = latestDate(entry.current.watchedAt, legacy.watchedAt);
    entry.current.status = "watched";
  }

  for (const legacy of titleRatings) {
    const type = canonicalType(legacy.mediaType);
    const entry = getEntry(type, Number(legacy.tmdbId), legacy.title || "Unknown", legacy.createdAt);
    fillMissing(entry.current, { title: legacy.title, poster: legacy.posterPath });
    const value = normalizeLegacyRating(legacy.value);
    if (value != null && entry.current.userRating == null) entry.current.userRating = value;
    if (type === "series" && !entry.current.ratingStatus) {
      entry.current.ratingStatus = "legacy_migrated_pending_completion";
    }
  }

  const creates: Prisma.MediaCreateManyInput[] = [];
  const updates: { id: string; data: Prisma.MediaUpdateInput }[] = [];
  for (const entry of working.values()) {
    if (!entry.existing) {
      creates.push({
        userId,
        tmdbId: entry.tmdbId,
        title: entry.current.title,
        type: entry.type,
        poster: entry.current.poster,
        overview: entry.current.overview,
        year: entry.current.year,
        rating: entry.current.rating,
        runtime: entry.current.runtime,
        status: entry.current.status,
        isFollowing: entry.current.isFollowing,
        watched: entry.current.watched,
        watchedAt: entry.current.watchedAt,
        userRating: entry.current.userRating,
        ratingStatus: entry.current.ratingStatus,
        addedAt: entry.current.addedAt,
      });
      continue;
    }
    const data = updatePatch(entry);
    if (Object.keys(data).length > 0) updates.push({ id: entry.existing.id, data });
  }

  if (creates.length > 0) {
    const created = await tx.media.createMany({ data: creates, skipDuplicates: true });
    report.canonical.created = created.count;
  }
  for (const update of updates) {
    await tx.media.update({ where: { id: update.id }, data: update.data });
  }
  report.canonical.updated = updates.length;

  // One verification query covers every legacy row. Cleanup cannot happen if a
  // single title, watched state or title rating failed to reach Media.
  const canonicalRows: Media[] = await tx.media.findMany({
    where: { userId, tmdbId: { in: impactedIds }, type: { in: ["movie", "series"] } },
  });
  const canonicalByKey = new Map<string, Media>(
    canonicalRows.map((item) => [mediaKey(item.type as CanonicalType, Number(item.tmdbId)), item]),
  );

  for (const legacy of watchedMovies) {
    const item = canonicalByKey.get(mediaKey("movie", Number(legacy.tmdbId)));
    if (!item?.watched) throw new Error(`Legacy watched movie ${legacy.tmdbId} was not preserved`);
  }
  for (const legacy of titleRatings) {
    const item = canonicalByKey.get(mediaKey(canonicalType(legacy.mediaType), Number(legacy.tmdbId)));
    if (item?.userRating == null) throw new Error(`Legacy title rating ${legacy.mediaType}:${legacy.tmdbId} was not preserved`);
  }
  for (const legacy of watchlist) {
    if (!canonicalByKey.has(mediaKey(canonicalType(legacy.mediaType), Number(legacy.tmdbId)))) {
      throw new Error(`Legacy watchlist item ${legacy.mediaType}:${legacy.tmdbId} was not preserved`);
    }
  }
  for (const legacy of following) {
    const item = canonicalByKey.get(mediaKey("series", Number(legacy.tmdbId)));
    if (!item?.isFollowing) {
      throw new Error(`Legacy following show ${legacy.tmdbId} was not preserved`);
    }
  }

  // Delete only rows that were included in this verified snapshot. During a
  // rolling deploy an older instance could still write a legacy row; deleting
  // by userId would erase that unprocessed row. A second transaction pass
  // below picks up any row that arrived during the first pass.
  const [deletedWatchlist, deletedWatchedMovies, deletedFollowing, deletedTitleRatings] = await Promise.all([
    tx.watchlistItem.deleteMany({ where: { id: { in: watchlist.map((item) => item.id) } } }),
    tx.watchedMovie.deleteMany({ where: { id: { in: watchedMovies.map((item) => item.id) } } }),
    tx.followingShow.deleteMany({ where: { id: { in: following.map((item) => item.id) } } }),
    tx.rating.deleteMany({ where: { id: { in: titleRatings.map((item) => item.id) } } }),
  ]);
  report.cleaned = {
    watchlist: deletedWatchlist.count,
    watchedMovies: deletedWatchedMovies.count,
    following: deletedFollowing.count,
    titleRatings: deletedTitleRatings.count,
  };
  return report;
}

function isLegacySchemaUnavailable(error: unknown) {
  const message = String((error as any)?.message || error || "");
  return /does not exist|Unknown arg|Unknown field|Cannot read properties of undefined/i.test(message);
}

/**
 * Runs once per user/process. Migration and cleanup are one atomic transaction;
 * a verification failure leaves every legacy row untouched.
 */
export function ensureLegacyLibraryMigrated(userId: string): Promise<LegacyLibraryMigrationReport> {
  const existing = migrationPromises.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    let aggregate: LegacyLibraryMigrationReport | null = null;

    // Repeated verified passes close the rolling-deploy race: pass one migrates
    // its snapshot, and the following pass confirms that an older instance did
    // not add another legacy row while deployment was switching over.
    for (let pass = 0; pass < 3; pass++) {
      const report: LegacyLibraryMigrationReport = await db.$transaction(
        (tx) => migrateInsideTransaction(tx, userId),
        { maxWait: 10_000, timeout: 120_000, isolationLevel: "Serializable" },
      );
      if (report.mode === "already-clean") return aggregate ?? report;
      if (!aggregate) {
        aggregate = report;
      } else {
        aggregate = {
          mode: "applied",
          userId,
          legacy: {
            watchlist: aggregate.legacy.watchlist + report.legacy.watchlist,
            watchedMovies: aggregate.legacy.watchedMovies + report.legacy.watchedMovies,
            following: aggregate.legacy.following + report.legacy.following,
            titleRatings: aggregate.legacy.titleRatings + report.legacy.titleRatings,
          },
          canonical: {
            created: aggregate.canonical.created + report.canonical.created,
            updated: aggregate.canonical.updated + report.canonical.updated,
            preservedStrongerState: aggregate.canonical.preservedStrongerState + report.canonical.preservedStrongerState,
          },
          cleaned: {
            watchlist: aggregate.cleaned.watchlist + report.cleaned.watchlist,
            watchedMovies: aggregate.cleaned.watchedMovies + report.cleaned.watchedMovies,
            following: aggregate.cleaned.following + report.cleaned.following,
            titleRatings: aggregate.cleaned.titleRatings + report.cleaned.titleRatings,
          },
        };
      }
    }
    throw new Error("Legacy title tables kept changing during migration; retrying is required.");
  })().catch((error) => {
    migrationPromises.delete(userId);
    if (isLegacySchemaUnavailable(error)) {
      return {
        mode: "unavailable",
        userId,
        legacy: { watchlist: 0, watchedMovies: 0, following: 0, titleRatings: 0 },
        canonical: { created: 0, updated: 0, preservedStrongerState: 0 },
        cleaned: { watchlist: 0, watchedMovies: 0, following: 0, titleRatings: 0 },
      } satisfies LegacyLibraryMigrationReport;
    }
    throw error;
  });

  migrationPromises.set(userId, promise);
  return promise;
}
