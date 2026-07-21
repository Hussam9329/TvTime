#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => readFileSync(resolve(root, file), "utf8");
const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

const trackingRoute = read("src/app/api/tv-tracking/route.ts");
const trackingCounts = read("src/lib/tv-tracking-counts.ts");
const statusServer = read("src/lib/tv-status-server.ts");
const discoverRoute = read("src/app/api/discover/filtered/route.ts");
const discoverBudget = read("src/lib/discover-budget.ts");
const verifyAll = read("scripts/verify-all.mjs");
const verifyCi = read("scripts/verify-ci.mjs");
const qualityWorkflow = read(".github/workflows/quality.yml");
const schemaWorkflow = read(".github/workflows/schema-migrations.yml");
const readme = read("README.md");
const envExample = read(".env.example");
const brand = read("src/lib/brand.ts");
const pkg = JSON.parse(read("package.json"));

const fastStart = trackingRoute.indexOf("async function buildTrackingCounts");
const fastEnd = trackingRoute.indexOf("async function buildTrackingSnapshot");
const fastBlock = fastStart >= 0 && fastEnd > fastStart ? trackingRoute.slice(fastStart, fastEnd) : "";
const countsBranch = trackingRoute.indexOf("if (countsOnly)");
const userBootstrap = trackingRoute.indexOf("const user = await getOrCreateUser(requestUserId)");
requireCheck(fastStart >= 0, "TV counts fast-path function is missing");
requireCheck((fastBlock.match(/\$queryRaw/g) || []).length === 1, "TV counts fast path must use exactly one database statement");
requireCheck(!/getTvStatusMetadata|batchReadDbMetadata|materializeLegacyCompletionSnapshot|\.update\(|\.upsert\(/.test(fastBlock), "TV counts fast path contains TMDB/cache/repair writes");
requireCheck(countsBranch >= 0 && userBootstrap > countsBranch, "countsOnly must return before user bootstrap or legacy migration");
requireCheck(/dbQueryBudget:\s*1/.test(trackingRoute) && /X-TvTime-DB-Query-Budget/.test(trackingRoute), "TV counts response does not publish its one-query budget");
requireCheck(/episodeCount > 0[\s\S]*"watching"/.test(trackingCounts), "fast counts do not preserve real progress when metadata is stale");
requireCheck(/airedEpisodeCount[\s\S]*officiallyEnded === true \? "finished" : "uptodate"/.test(trackingCounts), "fast counts do not distinguish caught-up ongoing and finished shows");

requireCheck(/await \(db\.tvMetadataCache as any\)\.upsert/.test(statusServer), "TV metadata cache upsert is still fire-and-forget");
requireCheck(/await writeDbMetadata\(metadata, refreshAfter\)/.test(statusServer), "TMDB metadata fetch does not wait for the cache write to settle");

requireCheck(/DISCOVER_TMDB_PAGE_BUDGET\s*=\s*8/.test(discoverBudget), "Discover per-request page budget must remain eight");
requireCheck(/DISCOVER_FETCH_BATCH_SIZE\s*=\s*3/.test(discoverBudget), "Discover concurrency batch must remain bounded");
requireCheck(/nextDiscoverPageBatch/.test(discoverRoute) && /pagesFetched < DISCOVER_TMDB_PAGE_BUDGET/.test(discoverRoute), "Discover route does not enforce the shared request budget");
requireCheck(/partial:\s*budgetExhausted/.test(discoverRoute) && /next_cursor/.test(discoverRoute), "budget exhaustion does not return a resumable cursor");
requireCheck(/resolveUserId\(req\)/.test(discoverRoute) && !/getOrCreateUser/.test(discoverRoute), "Discover GET still performs user bootstrap or migration writes");
requireCheck(/X-TvTime-TMDB-Page-Budget/.test(discoverRoute), "Discover response does not expose the enforced TMDB budget");

requireCheck(/const failures = \[\]/.test(verifyAll) && /Maintained verification summary/.test(verifyAll), "verify:all does not aggregate every maintained suite");
requireCheck(/const failures = \[\]/.test(verifyCi) && /CI gate summary/.test(verifyCi), "verify:ci does not aggregate lint, typecheck and behavior stages");
requireCheck(/fail-fast:\s*false/.test(qualityWorkflow), "GitHub quality matrix stops at the first failed stage");
requireCheck(/bun run lint:strict/.test(qualityWorkflow) && /bun run typecheck/.test(qualityWorkflow) && /bun run verify:all/.test(qualityWorkflow), "GitHub quality workflow is missing a required independent stage");
requireCheck(/postgres:16/.test(schemaWorkflow) && /prisma migrate deploy/.test(schemaWorkflow) && /bun run build/.test(schemaWorkflow), "schema workflow does not build against an empty migrated PostgreSQL database");

requireCheck(pkg.engines?.node === ">=20.9.0", "package.json does not enforce the Next.js Node minimum");
requireCheck(read(".nvmrc").trim() === "20.9.0", ".nvmrc does not pin Node 20.9.0");
requireCheck(pkg.scripts?.["lint:strict"] === "eslint . --max-warnings=0", "strict zero-warning lint command is missing");
requireCheck(String(pkg.scripts?.["verify:patch-10"] || "").includes("test-patch-10") && String(pkg.scripts?.["verify:patch-10"] || "").includes("verify-patch-10"), "Patch 10 tests are not wired into package.json");
requireCheck(/Node\.js 20\.9\.0 or newer/.test(readme), "README still documents an unsupported Node version");
requireCheck(/TMDB_API_KEY` is required/.test(readme) && /TMDB API key — required at runtime/.test(envExample), "TMDB requirement is not documented consistently");

requireCheck(/APP_NAME = "TvTime"/.test(brand) && /BACKUP_FILE_PREFIX = "tvtime-backup"/.test(brand), "canonical product identity is not centralized");
for (const file of ["src/components/layout/header.tsx", "src/components/layout/footer.tsx", "src/app/login/page.tsx", "src/app/api/library/export/route.ts"]) {
  requireCheck(!/CineTrack/.test(read(file)), `${file} still exposes the legacy product name`);
}
for (const file of [
  "src/components/media/rating-stars.tsx",
  "src/components/media/continue-watching.tsx",
  "src/components/views/arabic-movie-schedule.tsx",
  "src/lib/local-storage.ts",
]) {
  requireCheck(!existsSync(resolve(root, file)), `${file} remains as unmounted or superseded runtime code`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (["node_modules", ".next", ".git"].includes(entry)) return [];
    const absolute = resolve(dir, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}
const conflicts = [];
for (const absolute of walk(root)) {
  const file = relative(root, absolute).replaceAll("\\", "/");
  if (!/\.(?:ts|tsx|mjs|js|json|md|yml|yaml|prisma|sql)$/.test(file)) continue;
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(readFileSync(absolute, "utf8"))) conflicts.push(file);
}
requireCheck(conflicts.length === 0, `merge-conflict markers found: ${conflicts.join(", ")}`);

if (failures.length > 0) {
  console.error("[patch-10] verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("[patch-10] Performance budgets, reliable TV cache writes, aggregate CI, current docs/branding and reviewed dead-code cleanup are present.");
