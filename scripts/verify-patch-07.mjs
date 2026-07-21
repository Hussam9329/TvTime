#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];

function requireText(path, patterns) {
  const source = read(path);
  for (const [pattern, label] of patterns) {
    if (!pattern.test(source)) failures.push(`${path}: ${label}`);
  }
  return source;
}

requireText("prisma/schema.prisma", [
  [/originalLanguage\s+String\?/, "cached original language is missing"],
  [/originCountries\s+String\[\]/, "cached origin countries are missing"],
  [/genreIds\s+Int\[\]/, "cached genre ids are missing"],
  [/genreNames\s+String\[\]/, "cached genre names are missing"],
  [/classificationComplete\s+Boolean/, "classification completeness marker is missing"],
]);
requireText("prisma/migrations/20260717000000_tv_metadata_cache_integrity/migration.sql", [
  [/ADD COLUMN(?: IF NOT EXISTS)? "originalLanguage"/, "originalLanguage migration is missing"],
  [/ADD COLUMN(?: IF NOT EXISTS)? "originCountries"/, "originCountries migration is missing"],
  [/ADD COLUMN(?: IF NOT EXISTS)? "genreIds"/, "genreIds migration is missing"],
  [/ADD COLUMN(?: IF NOT EXISTS)? "genreNames"/, "genreNames migration is missing"],
  [/ADD COLUMN(?: IF NOT EXISTS)? "classificationComplete"/, "classification marker migration is missing"],
]);
requireText("src/lib/tv-status-engine.ts", [
  [/progressIntersectionKnown/, "ongoing watched progress does not require an exact key boundary"],
  [/const verified = boundaryKnown && progressIntersectionKnown/, "verification still trusts counts alone"],
  [/state: "watching"[\s\S]*verified: false/, "unverified progress does not stay Watching"],
]);
requireText("src/lib/tv-status-server.ts", [
  [/classificationComplete: true/, "fresh TMDB classification is not marked complete"],
  [/requireClassification && !row\.classificationComplete/, "old incomplete cache rows are not bypassed"],
  [/episodeKeysForTmdbIds/, "selective aired-key cache projection is missing"],
  [/await writeDbMetadata\(metadata, refreshAfter\)/, "persistent cache write is not awaited"],
  [/providedMetadata\?: TvStatusMetadata/, "episode release validation cannot reuse prefetched metadata"],
]);
requireText("src/app/api/tv-tracking/route.ts", [
  [/episodeKeysForTmdbIds: showsNeedingKeys/, "tracking cache does not request exact keys for progressed shows"],
  [/derived\.verified[\s\S]*watched\.count > 0[\s\S]*\? "watching"/, "unverified real progress can still inherit Not Started"],
]);
const watchedRoute = requireText("src/app/api/library/watched-episodes/route.ts", [
  [/requireClassification: true/, "episode mutations may reuse incomplete classification cache rows"],
  [/validateReleasedEpisodeBatch\(showId, requested, now, metadata\)/, "release validation refetches metadata"],
  [/lockSeriesMedia\(tx, ensuredMedia\.id\)/, "concurrent episode mutations do not lock the Media row"],
  [/updateShowStatusInTransaction\(tx, lockedMedia/, "Media state is not updated inside the mutation transaction"],
  [/safeUnverifiedState/, "unverified metadata has no safe persisted fallback state"],
  [/timeout: 30_000/, "episode mutation transactions have no explicit timeout"],
]);
const atomicStatusUpdates = watchedRoute.match(/return updateShowStatusInTransaction\(tx, lockedMedia, user\.id, showId, metadata\)/g) || [];
if (atomicStatusUpdates.length !== 2) {
  failures.push("POST and DELETE must both return the atomic status update inside their transaction");
}
const boundedTransactions = watchedRoute.match(/timeout: 30_000/g) || [];
if (boundedTransactions.length !== 2) {
  failures.push("POST and DELETE must both use a bounded transaction timeout");
}
if (/autoUpdateShowStatus/.test(watchedRoute)) {
  failures.push("watched-episodes route still performs a post-transaction status update");
}

const packageJson = JSON.parse(read("package.json"));
const patchScript = String(packageJson.scripts?.["verify:patch-07"] || "");
if (!patchScript.includes("test-tv-cache-regression")) {
  failures.push("package.json: verify:patch-07 does not run the cache regression test");
}
if (!patchScript.includes("verify-patch-07")) {
  failures.push("package.json: verify:patch-07 does not run source verification");
}

if (failures.length > 0) {
  console.error("[patch-07] verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("[patch-07] TV cache classification, progress boundaries and atomic episode mutations are guarded.");
