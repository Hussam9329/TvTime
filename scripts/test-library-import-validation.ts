import assert from "node:assert/strict";
import {
  importStartSchema,
  normalizeImportRecord,
} from "../src/lib/library-import-validation.ts";
import {
  LIBRARY_BACKUP_KIND,
  LIBRARY_BACKUP_VERSION,
} from "../src/lib/library-transfer-types.ts";

const normalizedMedia = normalizeImportRecord({
  collection: "media",
  ordinal: 0,
  data: {
    tmdbId: "42",
    title: "Example show",
    type: "tv",
    status: "up_to_date",
    watched: "false",
    rewatch: "0",
    isArabic: "true",
    isAnime: "true",
    isFollowing: "yes",
    notifyOnNewEpisode: "false",
    originCountries: ["iq", "IQ"],
  },
});
assert.equal(normalizedMedia.payload.type, "series");
assert.equal(normalizedMedia.payload.status, "not_started", "episode rows must re-derive series progress");
assert.equal(normalizedMedia.payload.watched, false);
assert.equal(normalizedMedia.payload.rewatch, false);
assert.equal(normalizedMedia.payload.isArabic, true);
assert.equal(normalizedMedia.payload.isAnime, false, "Arabic and anime worlds must remain mutually exclusive");
assert.equal(normalizedMedia.payload.isFollowing, true);
assert.equal(normalizedMedia.payload.notifyOnNewEpisode, false, 'the string "false" must not become true');
assert.deepEqual(normalizedMedia.payload.originCountries, ["IQ"]);

const promotedLegacyArabic = normalizeImportRecord({
  collection: "media",
  ordinal: 3,
  data: {
    tmdbId: 43,
    title: "Legacy Arabic metadata",
    type: "movie",
    isArabic: false,
    isAnime: true,
    originalLanguage: "AR",
    originCountries: ["iq"],
  },
});
assert.equal(promotedLegacyArabic.payload.isArabic, true, "Arabic-language legacy rows must be promoted");
assert.equal(promotedLegacyArabic.payload.isAnime, false, "Arabic promotion must preserve world exclusivity");
assert.equal(promotedLegacyArabic.payload.originalLanguage, "ar");
assert.deepEqual(promotedLegacyArabic.payload.originCountries, ["IQ"]);

const special = normalizeImportRecord({
  collection: "watchedEpisodes",
  ordinal: 0,
  data: { showId: 7, seasonNumber: 0, episodeNumber: 1, watchedAt: "2026-07-20T10:00:00.000Z" },
});
assert.equal(special.payload.seasonNumber, 0, "season zero specials are valid");
assert.throws(() => normalizeImportRecord({
  collection: "watchedEpisodes",
  ordinal: 1,
  data: { showId: 7, seasonNumber: -1, episodeNumber: 1 },
}));
assert.throws(() => normalizeImportRecord({
  collection: "media",
  ordinal: 2,
  data: { title: "Bad state", type: "movie", status: "arbitrary-state" },
}));

const goodManifest = {
  kind: LIBRARY_BACKUP_KIND,
  version: LIBRARY_BACKUP_VERSION,
  format: "ndjson" as const,
  collections: { media: 2, watchedEpisodes: 3, episodeRatings: 1 },
  totalRecords: 6,
};
assert.equal(importStartSchema.parse({ manifest: goodManifest }).manifest.totalRecords, 6);
assert.throws(() => importStartSchema.parse({
  manifest: { ...goodManifest, totalRecords: 7 },
}), /Manifest collection counts/);

console.log("Library import validation tests passed.");
