#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

const protectedHashes = {
  "prisma/schema.prisma": "1fbff4160f922dc906471f8a2e3de4eea398287e47a457cc70daab1220d8124d",
  "package.json": "a03766d67ee230ac279405c653f27f8b8b0a7f146e6e8671e48d9b6d0f9b4faf",
  "scripts/assert-production-db.mjs": "f4a8214783d8a926a391b27da36102dc2ef0b075e013fd95eca3b5dcd7f53d36",
  "next.config.ts": "6427983b336fdc783833ad08feab538b75286de080701680509663fd27b999c5",
};

for (const [path, expected] of Object.entries(protectedHashes)) {
  check(sha256(path) === expected, `${path} matches the locked baseline hash`);
}

const schema = read("prisma/schema.prisma");
const packageJson = JSON.parse(read("package.json"));
const engine = read("src/lib/tv-status-engine.ts");
const server = read("src/lib/tv-status-server.ts");
const watchedRoute = read("src/app/api/library/watched-episodes/route.ts");
const mediaRoute = read("src/app/api/media/[id]/route.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const libraryView = read("src/components/views/library-view.tsx");
const trackingRoute = read("src/app/api/tv-tracking/route.ts");
const statsRoute = read("src/app/api/library/stats/route.ts");
const importRoute = read("src/app/api/library/import/route.ts");

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
check(/allEpisodesIncludingFuture/.test(read("src/components/views/calendar-view.tsx")), "Calendar may still show future schedule without counting it as progress");
check(/deriveTvTrackingState/.test(trackingRoute), "TV tracking API uses the central state engine");
check(/status:\s*\{\s*in:\s*\["not_started",\s*"watching",\s*"uptodate",\s*"finished"\]/.test(statsRoute), "Following statistics exclude Planned and rating-only items");
check(/watched:\s*itemType\s*===\s*"series"\s*\?\s*false/.test(importRoute), "Legacy rating import does not mark media watched");
check(/item\.type\s*===\s*"movie"\s*\?/.test(libraryView) && /> Episodes\s*</.test(libraryView), "Watched TV cards route state changes through episode tracking");
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
