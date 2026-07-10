// Import a legacy or TVM backup into the canonical SQLite Media table.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import {
  canonicalStateFromLegacy,
  compatibilityFieldsForState,
  mergeCanonicalStates,
} from "../src/lib/media-state";

const db = new PrismaClient({ log: ["error"] });

type BackupItem = {
  id?: string;
  userId?: string;
  tmdbId?: number | null;
  title: string;
  originalTitle?: string | null;
  year?: string | null;
  type: string;
  poster?: string | null;
  rating?: string | number | null;
  overview?: string | null;
  genres?: string[];
  genresJson?: string;
  episodes?: number | null;
  seasons?: number | null;
  duration?: string | null;
  libraryState?: string | null;
  status?: string | null;
  author?: string | null;
  pages?: number | null;
  tags?: string[];
  tagsJson?: string;
  notes?: string | null;
  watched?: boolean;
  watchedAt?: string | null;
  userRating?: number | null;
  rewatch?: boolean;
  runtime?: number | null;
  ratingStatus?: string | null;
  isAnime?: boolean;
  addedAt?: string;
};

function jsonArray(value: unknown, fallback: unknown = []) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(Array.isArray(parsed) ? parsed : fallback);
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(Array.isArray(value) ? value : fallback);
}

async function main() {
  const requestedPath = process.argv[2];
  if (!requestedPath) {
    throw new Error("Usage: bun scripts/import-backup.ts <backup.json>");
  }
  const backupPath = path.resolve(requestedPath);
  const payload = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const items: BackupItem[] = Array.isArray(payload) ? payload : payload.media || [];

  let imported = 0;
  let updated = 0;
  for (const item of items) {
    const type = item.type === "tv" ? "series" : item.type;
    const userId = item.userId || "cinetrack_default";
    const incomingState = canonicalStateFromLegacy({ ...item, type });
    const tmdbId = item.tmdbId == null ? null : Number(item.tmdbId);
    const existing = tmdbId == null
      ? await db.media.findFirst({ where: { userId, type, title: item.title, tmdbId: null } })
      : await db.media.findFirst({ where: { userId, type, tmdbId } });

    const state = existing
      ? mergeCanonicalStates(canonicalStateFromLegacy(existing), incomingState)
      : incomingState;
    const compatibility = compatibilityFieldsForState(state, type, {
      currentWatchedAt: existing?.watchedAt || item.watchedAt || null,
    });
    const data = {
      userId,
      tmdbId,
      title: item.title,
      originalTitle: item.originalTitle || null,
      year: item.year || null,
      type,
      poster: item.poster || null,
      rating: item.rating == null ? null : String(item.rating),
      overview: item.overview || null,
      genresJson: jsonArray(item.genresJson ?? item.genres),
      episodes: item.episodes ?? null,
      seasons: item.seasons ?? null,
      duration: item.duration || null,
      author: item.author || null,
      pages: item.pages ?? null,
      tagsJson: jsonArray(item.tagsJson ?? item.tags),
      notes: item.notes || null,
      userRating: item.userRating ?? null,
      rewatch: Boolean(item.rewatch),
      runtime: item.runtime ?? null,
      ratingStatus: item.ratingStatus || null,
      isAnime: Boolean(item.isAnime),
      ...(item.addedAt ? { addedAt: new Date(item.addedAt) } : {}),
      ...compatibility,
    };

    if (existing) {
      await db.media.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await db.media.create({ data: { ...(item.id ? { id: item.id } : {}), ...data } });
      imported += 1;
    }
  }

  console.log(`[TVM] import complete: created=${imported}, updated=${updated}, source=${backupPath}`);
}

main()
  .catch((error) => {
    console.error("[TVM] import failed", error);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());
