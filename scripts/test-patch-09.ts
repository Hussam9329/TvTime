import assert from "node:assert/strict";
import { importStartSchema, normalizeImportRecord } from "../src/lib/library-import-validation.ts";
import {
  LIBRARY_BACKUP_KIND,
  LIBRARY_BACKUP_VERSION,
  emptyCollectionCounts,
} from "../src/lib/library-transfer-types.ts";

assert.equal(LIBRARY_BACKUP_VERSION, 6);

const legacyV5 = importStartSchema.parse({
  manifest: {
    kind: LIBRARY_BACKUP_KIND,
    version: 5,
    format: "ndjson",
    collections: { media: 1, watchedEpisodes: 2, episodeRatings: 0 },
    totalRecords: 3,
  },
});
assert.equal(legacyV5.manifest.collections.watchSessions, 0, "v5 manifests must gain zero-count v6 collections");

const counts = { ...emptyCollectionCounts(), media: 1, watchSessions: 1, notifications: 1, preferences: 1 };
const current = importStartSchema.parse({
  manifest: {
    kind: LIBRARY_BACKUP_KIND,
    version: 6,
    format: "ndjson",
    collections: counts,
    totalRecords: Object.values(counts).reduce((sum, count) => sum + count, 0),
  },
});
assert.equal(current.manifest.collections.preferences, 1);

const diary = normalizeImportRecord({
  collection: "watchSessions",
  ordinal: 0,
  data: {
    mediaType: "arabic_tv",
    tmdbId: 77,
    title: "جلسة اختبار",
    season: 0,
    episode: 1,
    watchedAt: "2026-07-20T20:00:00.000Z",
    rating: 90,
  },
});
assert.equal(diary.payload.mediaId, null, "restores must not trust a foreign mediaId");
assert.equal(diary.payload.season, 0);

const notification = normalizeImportRecord({
  collection: "notifications",
  ordinal: 0,
  data: { type: "new_episode", title: "New episode", body: "Episode is available", read: false },
});
assert.equal(notification.payload.read, false);

const preferences = normalizeImportRecord({
  collection: "preferences",
  ordinal: 0,
  data: { timezone: "Asia/Baghdad", country: "iq", preferredPlatforms: ["Shahid", "Shahid"] },
});
assert.equal(preferences.payload.country, "IQ");
assert.deepEqual(preferences.payload.preferredPlatforms, ["Shahid"]);

assert.throws(() => normalizeImportRecord({
  collection: "watchSessions",
  ordinal: 1,
  data: { mediaType: "movie", tmdbId: 1, title: "Invalid", rating: 101 },
}));

console.log("Patch 09 lifecycle validation tests passed.");
