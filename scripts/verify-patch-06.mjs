#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
const requireText = (path, patterns) => {
  const source = read(path);
  for (const [pattern, label] of patterns) {
    if (!pattern.test(source)) failures.push(`${path}: ${label}`);
  }
};

requireText("prisma/schema.prisma", [
  [/model LibraryImportSession\s*\{/, "LibraryImportSession model is missing"],
  [/model LibraryImportChunk\s*\{/, "LibraryImportChunk model is missing"],
  [/model LibraryImportRecord\s*\{/, "LibraryImportRecord model is missing"],
]);
requireText("prisma/migrations/20260716000000_staged_library_import/migration.sql", [
  [/CREATE TABLE "LibraryImportSession"/, "staging session table is missing"],
  [/CREATE TABLE "LibraryImportChunk"/, "chunk table is missing"],
  [/CREATE TABLE "LibraryImportRecord"/, "record table is missing"],
  [/LibraryImportSession_status_check/, "session state constraint is missing"],
  [/ENABLE ROW LEVEL SECURITY/g, "staging RLS is missing"],
]);
requireText("src/app/api/library/export/route.ts", [
  [/MAX_RESPONSE_RECORD_BYTES\s*=\s*1_500_000/, "export response budget is missing"],
  [/nextCursor/, "cursor pagination is missing"],
  [/collectionValue/, "collection-by-collection export is missing"],
]);
requireText("src/lib/library-backup-client.ts", [
  [/application\/x-ndjson/, "NDJSON download is missing"],
  [/file\.stream\(\)/, "streamed NDJSON parsing is missing"],
  [/checksum: await sha256\(records\)/, "client chunk checksum is missing"],
  [/\/finalize/, "preflight/finalize request is missing"],
  [/\/commit/, "explicit atomic commit request is missing"],
]);
requireText("src/app/api/library/import/[sessionId]/chunks/route.ts", [
  [/LIBRARY_IMPORT_MAX_CHUNK_BYTES/, "chunk byte limit is missing"],
  [/checksum\(parsed\.records\) !== parsed\.checksum/, "server checksum verification is missing"],
  [/FOR UPDATE/, "session upload serialization is missing"],
  [/normalizeImportRecord/, "record normalization is missing"],
]);
requireText("src/app/api/library/import/[sessionId]/finalize/route.ts", [
  [/IMPORT_CHUNK_SEQUENCE_GAP/, "contiguous sequence verification is missing"],
  [/IMPORT_COLLECTION_COUNT_MISMATCH/, "manifest collection validation is missing"],
  [/duplicateRecordsThatWillMerge/, "restore preview is missing duplicate reporting"],
]);
requireText("src/app/api/library/import/[sessionId]/commit/route.ts", [
  [/db\.\$transaction/, "commit is not wrapped in a transaction"],
  [/COMMIT:\$\{sessionId\}/, "preview-bound confirmation token is missing"],
  [/Atomic import failed; no library changes were committed/, "atomic failure contract is missing"],
]);
requireText("src/lib/library-import-commit.ts", [
  [/row_number\(\) OVER/g, "duplicate-safe staging merge is missing"],
  [/ON CONFLICT \("userId", "type", "tmdbId"\)/, "canonical Media upsert is missing"],
  [/ON CONFLICT \("userId", "showId", "seasonNumber", "episodeNumber"\)/, "episode upsert is missing"],
]);
requireText("src/components/profile/profile-dialog.tsx", [
  [/downloadLibraryBackup/, "paged backup client is not wired into the UI"],
  [/restoreLibraryBackup/, "staged restore client is not wired into the UI"],
  [/\.ndjson/, "NDJSON file input is not enabled"],
  [/atomic/, "atomic restore preview is not explained"],
]);

const packageJson = JSON.parse(read("package.json"));
if (!packageJson.scripts?.["verify:patch-06"]?.includes("test-library-import-validation")) {
  failures.push("package.json: verify:patch-06 does not run validation tests");
}
if (!packageJson.scripts?.["verify:patch-06"]?.includes("verify-patch-06")) {
  failures.push("package.json: verify:patch-06 does not run source verification");
}

if (failures.length > 0) {
  console.error("[patch-06] verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("[patch-06] Paged export, staged validation and atomic commit guards are present.");
