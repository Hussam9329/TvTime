import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });
const STATE_PRIORITY = { none: 0, planned: 1, watching: 2, up_to_date: 3, completed: 4 };

function normalizeState(value) {
  if (typeof value !== "string") return null;
  const state = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  if (Object.prototype.hasOwnProperty.call(STATE_PRIORITY, state)) return state;
  if (["watchlist", "following", "plan_to_watch"].includes(state)) return "planned";
  if (["in_progress", "progress"].includes(state)) return "watching";
  if (["uptodate", "caught_up"].includes(state)) return "up_to_date";
  if (["watched", "finished", "complete"].includes(state)) return "completed";
  return null;
}

function inferredState(row) {
  const stored = normalizeState(row.libraryState);
  if (stored && stored !== "none") return stored;
  const legacy = normalizeState(row.status);
  if (legacy) return legacy;
  if (row.watched === true || row.watched === 1 || row.watched === 1n) return "completed";
  if (row.type === "movie" && row.watchedAt != null) return "completed";
  return stored || "none";
}

function asTime(value, fallback = 0) {
  if (value == null) return fallback;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

function mergeJsonArray(rows, key) {
  const values = [];
  const seen = new Set();
  for (const row of rows) {
    const raw = row[key];
    let parts = [];
    if (Array.isArray(raw)) parts = raw;
    else if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        parts = Array.isArray(parsed) ? parsed : raw.split(",");
      } catch {
        parts = raw.split(",");
      }
    }
    for (const part of parts) {
      const text = String(part || "").trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        values.push(text);
      }
    }
  }
  return values.length ? JSON.stringify(values) : null;
}

function chooseWinner(rows) {
  return [...rows].sort((a, b) => {
    const stateDiff = STATE_PRIORITY[inferredState(b)] - STATE_PRIORITY[inferredState(a)];
    if (stateDiff) return stateDiff;
    const ratingDiff = Number(b.userRating != null) - Number(a.userRating != null);
    if (ratingDiff) return ratingDiff;
    return asTime(b.updatedAt) - asTime(a.updatedAt);
  })[0];
}

async function main() {
  const tables = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name='Media'`);
  if (!Array.isArray(tables) || tables.length === 0) {
    console.log("[TVM] SQLite preflight: Media table does not exist yet; nothing to deduplicate.");
    return;
  }

  const columnRows = await db.$queryRawUnsafe(`PRAGMA table_info("Media")`);
  const columns = new Set(columnRows.map((column) => String(column.name)));
  const rows = await db.$queryRawUnsafe(`SELECT * FROM "Media" WHERE "tmdbId" IS NOT NULL`);
  const groups = new Map();
  for (const row of rows) {
    const key = `${String(row.userId)}\u0000${String(row.type)}\u0000${String(row.tmdbId)}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  let removed = 0;
  for (const group of duplicateGroups) {
    const winner = chooseWinner(group);
    const newestFirst = [...group].sort((a, b) => asTime(b.updatedAt) - asTime(a.updatedAt));
    const updates = {};

    const fillFields = [
      "title", "originalTitle", "year", "poster", "rating", "overview", "episodes", "seasons",
      "duration", "author", "pages", "notes", "runtime", "ratingStatus",
    ];
    for (const key of fillFields) {
      if (!columns.has(key)) continue;
      const chosen = newestFirst.find((row) => isPresent(row[key]))?.[key];
      if (isPresent(chosen) && winner[key] !== chosen) updates[key] = chosen;
    }

    for (const key of ["genres", "tags"]) {
      if (!columns.has(key)) continue;
      const merged = mergeJsonArray(newestFirst, key);
      if (merged && winner[key] !== merged) updates[key] = merged;
    }

    if (columns.has("userRating")) {
      const chosen = newestFirst.find((row) => row.userRating != null)?.userRating;
      if (chosen != null && winner.userRating !== chosen) updates.userRating = chosen;
    }
    if (columns.has("rewatch")) updates.rewatch = group.some((row) => Boolean(row.rewatch));
    if (columns.has("isAnime")) updates.isAnime = group.some((row) => Boolean(row.isAnime));
    if (columns.has("addedAt")) {
      const oldest = group.reduce((best, row) => asTime(row.addedAt, Number.MAX_SAFE_INTEGER) < asTime(best.addedAt, Number.MAX_SAFE_INTEGER) ? row : best, group[0]);
      updates.addedAt = oldest.addedAt;
    }
    if (columns.has("updatedAt")) {
      const newest = newestFirst[0];
      updates.updatedAt = newest.updatedAt;
    }

    const updateEntries = Object.entries(updates).filter(([key]) => columns.has(key));
    if (updateEntries.length) {
      const setSql = updateEntries.map(([key]) => `"${key}" = ?`).join(", ");
      await db.$executeRawUnsafe(
        `UPDATE "Media" SET ${setSql} WHERE "id" = ?`,
        ...updateEntries.map(([, value]) => value),
        winner.id,
      );
    }

    const loserIds = group.filter((row) => row.id !== winner.id).map((row) => row.id);
    for (const id of loserIds) {
      await db.$executeRawUnsafe(`DELETE FROM "Media" WHERE "id" = ?`, id);
      removed++;
    }
  }

  console.log(`[TVM] SQLite preflight complete: duplicateGroups=${duplicateGroups.length}, removedRows=${removed}`);
}

main()
  .catch((error) => {
    console.error("[TVM] SQLite preflight failed", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
