import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });
const MARKER = "tvm_canonical_legacy_import_v1";
const VALID_STATES = new Set(["none", "planned", "watching", "up_to_date", "completed"]);
const PRIORITY = { none: 0, planned: 1, watching: 2, up_to_date: 3, completed: 4 };

function normalizeState(value) {
  if (typeof value !== "string") return null;
  const state = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  if (VALID_STATES.has(state)) return state;
  if (["watchlist", "following", "plan_to_watch"].includes(state)) return "planned";
  if (["in_progress", "progress"].includes(state)) return "watching";
  if (["uptodate", "caught_up"].includes(state)) return "up_to_date";
  if (["watched", "finished", "complete"].includes(state)) return "completed";
  return null;
}

function legacyState(item) {
  const stored = normalizeState(item.libraryState);
  const status = normalizeState(item.status);
  // A freshly added `libraryState=none` must not erase stronger legacy facts.
  if (stored && stored !== "none") return stored;
  if (status) return status;
  if (item.watched === true) return "completed";
  if (item.type === "movie" && item.watchedAt) return "completed";
  return stored || "none";
}

function mergeState(a, b) {
  return PRIORITY[b] > PRIORITY[a] ? b : a;
}

function posterUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const poster = value.trim();
  if (/^(https?:|data:|blob:)/i.test(poster)) return poster;
  if (poster.startsWith("/placeholder-") || poster === "/logo.svg") return poster;
  return poster.startsWith("/") ? `https://image.tmdb.org/t/p/w500${poster}` : poster;
}

function compatibility(state, type, watchedAt = null) {
  const now = new Date();
  const completed = state === "completed" || state === "up_to_date";
  const status = state === "none"
    ? null
    : state === "up_to_date"
      ? "uptodate"
      : state === "completed"
        ? type === "series" ? "finished" : "watched"
        : state;
  return {
    libraryState: state,
    status,
    watched: completed,
    watchedAt: completed ? watchedAt || now : null,
    stateChangedAt: now,
  };
}

async function upsertLegacyMedia({ userId, type, tmdbId, title, poster, overview, year, rating, runtime, state, watchedAt, userRating }) {
  const numericTmdbId = Number(tmdbId);
  let existing = await db.media.findFirst({ where: { userId, type, tmdbId: numericTmdbId } });
  if (!existing) {
    return db.media.create({
      data: {
        userId,
        type,
        tmdbId: numericTmdbId,
        title: title || "Unknown",
        poster: posterUrl(poster),
        overview: overview || null,
        year: year || null,
        rating: rating == null ? null : String(rating),
        runtime: runtime == null ? null : Number(runtime),
        userRating: userRating == null ? null : Number(userRating),
        ...compatibility(state, type, watchedAt),
      },
    });
  }

  const nextState = mergeState(legacyState(existing), state);
  const data = {
    ...(poster && !existing.poster ? { poster: posterUrl(poster) } : {}),
    ...(overview && !existing.overview ? { overview } : {}),
    ...(year && !existing.year ? { year } : {}),
    ...(rating != null && !existing.rating ? { rating: String(rating) } : {}),
    ...(runtime != null && !existing.runtime ? { runtime: Number(runtime) } : {}),
    ...(userRating != null && existing.userRating == null ? { userRating: Number(userRating) } : {}),
    ...compatibility(nextState, type, existing.watchedAt || watchedAt),
  };
  return db.media.update({ where: { id: existing.id }, data });
}

async function canonicalizeExistingMedia() {
  const rows = await db.media.findMany();
  let repaired = 0;
  for (const row of rows) {
    const state = legacyState(row);
    const expected = compatibility(state, row.type, row.watchedAt);
    const stale = row.libraryState !== expected.libraryState || row.status !== expected.status || row.watched !== expected.watched ||
      ((row.watchedAt == null) !== (expected.watchedAt == null));
    if (!stale) continue;
    await db.media.update({ where: { id: row.id }, data: expected });
    repaired++;
  }
  return repaired;
}

async function reconcileLegacyEpisodeFacts({ promoteNone = false } = {}) {
  const groups = await db.watchedEpisode.groupBy({
    by: ["userId", "showId"],
    where: { seasonNumber: { gt: 0 } },
    _count: { _all: true },
    _max: { watchedAt: true },
  });

  let created = 0;
  let promoted = 0;
  for (const group of groups) {
    let media = await db.media.findFirst({
      where: { userId: group.userId, type: "series", tmdbId: group.showId },
    });

    if (!media) {
      media = await db.media.create({
        data: {
          userId: group.userId,
          type: "series",
          tmdbId: group.showId,
          title: `TV ${group.showId}`,
          ...compatibility("watching", "series", group._max.watchedAt),
        },
      });
      created++;
      continue;
    }

    const current = legacyState(media);
    if (current !== "planned" && !(promoteNone && current === "none")) continue;

    const watchedCount = group._count._all;
    const knownTotal = Number(media.episodes || 0);
    const nextState = knownTotal > 0 && watchedCount >= knownTotal ? "up_to_date" : "watching";
    await db.media.update({
      where: { id: media.id },
      data: compatibility(nextState, "series", group._max.watchedAt),
    });
    promoted++;
  }

  return { created, promoted };
}

async function importLegacyTablesOnce() {
  const marker = await db.appMeta.findUnique({ where: { key: MARKER } });
  if (marker?.value === "done") return { skipped: true, imported: 0 };

  const [watchlist, watchedMovies, following, ratings] = await Promise.all([
    db.watchlistItem.findMany(),
    db.watchedMovie.findMany(),
    db.followingShow.findMany(),
    db.rating.findMany(),
  ]);

  let imported = 0;
  for (const item of watchlist) {
    await upsertLegacyMedia({
      userId: item.userId,
      type: item.mediaType === "tv" ? "series" : "movie",
      tmdbId: item.tmdbId,
      title: item.title,
      poster: item.posterPath,
      overview: item.overview,
      year: item.releaseDate?.slice(0, 4) || null,
      rating: item.voteAverage,
      state: "planned",
    });
    imported++;
  }

  for (const item of following) {
    await upsertLegacyMedia({
      userId: item.userId,
      type: "series",
      tmdbId: item.tmdbId,
      title: item.title,
      poster: item.posterPath,
      state: "planned",
    });
    imported++;
  }

  for (const item of watchedMovies) {
    await upsertLegacyMedia({
      userId: item.userId,
      type: "movie",
      tmdbId: item.tmdbId,
      title: item.title,
      poster: item.posterPath,
      runtime: item.runtime,
      state: "completed",
      watchedAt: item.watchedAt,
    });
    imported++;
  }

  // Ratings are metadata only. They never promote an item to completed.
  for (const item of ratings) {
    await upsertLegacyMedia({
      userId: item.userId,
      type: item.mediaType === "tv" ? "series" : "movie",
      tmdbId: item.tmdbId,
      title: item.title,
      poster: item.posterPath,
      state: "none",
      userRating: Math.max(0, Math.min(100, Number(item.value) * 10)),
    });
    imported++;
  }

  return { skipped: false, imported };
}

async function main() {
  const legacy = await importLegacyTablesOnce();
  const episodeFacts = await reconcileLegacyEpisodeFacts({ promoteNone: !legacy.skipped });
  const repaired = await canonicalizeExistingMedia();

  if (!legacy.skipped) {
    await db.appMeta.upsert({
      where: { key: MARKER },
      create: { key: MARKER, value: "done" },
      update: { value: "done" },
    });
  }

  console.log(`[TVM] canonical migration complete: legacyImported=${legacy.imported}, legacySkipped=${legacy.skipped}, episodeRowsCreated=${episodeFacts.created}, episodeStatesPromoted=${episodeFacts.promoted}, repaired=${repaired}`);
}

main()
  .catch((error) => {
    console.error("[TVM] canonical migration failed", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
