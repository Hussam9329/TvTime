#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}


function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

const productionGuard = read("scripts/assert-production-db.mjs");
const nextConfig = read("next.config.ts");
check(
  /DATABASE_URL/.test(productionGuard) && /postgresql?:/.test(productionGuard) && /fail closed/i.test(productionGuard),
  "Deployment target guard fails closed and accepts PostgreSQL only",
);
check(
  /Content-Security-Policy/.test(nextConfig) && /X-Frame-Options/.test(nextConfig) && /Strict-Transport-Security/.test(nextConfig),
  "Next.js configuration retains the reviewed security headers",
);

const schema = read("prisma/schema.prisma");
const packageJson = JSON.parse(read("package.json"));
const engine = read("src/lib/tv-status-engine.ts");
const server = read("src/lib/tv-status-server.ts");
const watchedRoute = read("src/app/api/library/watched-episodes/route.ts");
const mediaRoute = read("src/app/api/media/[id]/route.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const collectionView = read("src/components/views/collection-world-view.tsx");
const trackingRoute = read("src/app/api/tv-tracking/route.ts");
const statsRoute = read("src/app/api/library/stats/route.ts");
const libraryCounts = read("src/lib/library-counts.ts");
const importRoute = read("src/app/api/library/import/route.ts");
const importValidationPath = resolve(root, "src/lib/library-import-validation.ts");
const importValidation = existsSync(importValidationPath) ? read("src/lib/library-import-validation.ts") : null;

check(/provider\s*=\s*"postgresql"/.test(schema), "Prisma remains PostgreSQL");
check(/url\s*=\s*env\("DATABASE_URL"\)/.test(schema), "Prisma still reads DATABASE_URL");
check(!/db\s+(push|migrate|reset)/i.test(packageJson.scripts.build || ""), "Build performs no database migration/push/reset");
check(!/userRating/.test(engine), "TV state engine has no rating input or dependency");
check(/officiallyEnded\s*===\s*true\s*\?\s*"finished"\s*:\s*"uptodate"/.test(engine), "Only officially ended shows can become Finished");
check(/filterReleasedEpisodes/.test(engine) && /isEpisodeReleased/.test(engine), "Released episode filtering is centralized");
check(/EPISODE_NOT_RELEASED/.test(watchedRoute), "API rejects future or unaired watched episodes");
check(/validateReleasedEpisodeBatch/.test(watchedRoute), "Single and bulk episode writes use release validation");
check(/TV_STATE_REQUIRES_EPISODE_ENGINE/.test(mediaRoute), "Direct TV progress writes are blocked");
check(/TV_PROGRESS_MUST_BE_CHANGED_BY_EPISODES/.test(mediaRoute), "Existing TV episode progress cannot be overwritten by generic media updates");
check(/RATING_WATCH_STATE_MUST_BE_SEPARATE/.test(mediaRoute), "Rating and watch changes cannot be sent in one request");
check(/body:\s*JSON\.stringify\(\{\s*userRating:\s*args\.value[\s\S]*?\}\)/.test(hooks), "Rating save payload writes only userRating");
check(/body:\s*JSON\.stringify\(\{\s*userRating:\s*null\s*\}\)/.test(hooks), "Rating removal payload clears only userRating");
check(/allEpisodes\s*=\s*allEpisodesIncludingFuture\.filter/.test(hooks), "Client progress separates released and future episodes");
check(/nextEp\s*=\s*allEpisodes\.find/.test(hooks), "Next-to-watch is selected only from released episodes");
check(/deriveTvTrackingState/.test(trackingRoute), "TV tracking API uses the central state engine");
check(/type:\s*"series",\s*isAnime:\s*false,\s*isArabic:\s*false,\s*isFollowing:\s*true/.test(libraryCounts), "Following statistics use explicit TV following membership and exclude Anime and Arabic TV");
const seriesImportResetsWholeShowCompletion = importValidation
  ? /watched:\s*parsed\.type\s*===\s*"series"\s*\?\s*false/.test(importValidation)
  : /watched:\s*itemType\s*===\s*"series"\s*\?\s*false/.test(importRoute);
check(seriesImportResetsWholeShowCompletion, "Legacy rating import does not mark media watched");
check(
  /if\s*\(item\.type\s*===\s*"series"\)[\s\S]{0,300}goTv\(item\.tmdbId\)/.test(collectionView)
    && /Open episode tracking/.test(collectionView),
  "Watched TV cards route state changes through episode tracking",
);
check(/getAllReleasedEpisodes/.test(server) && /isEpisodeReleased/.test(server), "Server computes released episodes from episode air dates");

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
  passes.push("git diff --check passed");
} catch {
  passes.push("git diff --check skipped outside a Git checkout");
}

for (const message of passes) console.log(`PASS: ${message}`);
if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\nTVM-03/04/05 verification failed (${failures.length} failure(s)).`);
  process.exit(1);
}

console.log(`\nTVM-03/04/05 static verification passed (${passes.length} checks).`);
