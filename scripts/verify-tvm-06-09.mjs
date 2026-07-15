#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const root = process.cwd();
const failures = [];
const passes = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
const sha256 = (path) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const check = (condition, message) => (condition ? passes : failures).push(message);

const protectedHashes = {
  "scripts/assert-production-db.mjs": "f4a8214783d8a926a391b27da36102dc2ef0b075e013fd95eca3b5dcd7f53d36",
  "next.config.ts": "6427983b336fdc783833ad08feab538b75286de080701680509663fd27b999c5",
};
for (const [path, expected] of Object.entries(protectedHashes)) {
  check(sha256(path) === expected, `${path} remains on the reviewed infrastructure baseline`);
}

const schema = read("prisma/schema.prisma");
const packageJson = JSON.parse(read("package.json"));
const engine = read("src/lib/tv-status-engine.ts");
const statusServer = read("src/lib/tv-status-server.ts");
const trackingRoute = read("src/app/api/tv-tracking/route.ts");
const mediaUpdateRoute = read("src/app/api/media/[id]/route.ts");
const ratingRoute = read("src/app/api/library/ratings/route.ts");
const importRoute = read("src/app/api/library/import/route.ts");
const eligibility = read("src/lib/tv-rating-eligibility.ts");
const episodeRating = read("src/lib/episode-rating.ts");
const ratingRules = read("src/lib/tv-rating-rules.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const providers = read("src/components/providers.tsx");
const detailView = read("src/components/views/tv-detail-view.tsx");
const trackingView = read("src/components/views/tv-tracking-view.tsx");
const libraryStats = read("src/app/api/library/stats/route.ts");
const mediaStats = read("src/app/api/media/stats/route.ts");
const legacyBackupScript = read("scripts/import-backup.ts");

check(/provider\s*=\s*"postgresql"/.test(schema), "Prisma provider remains PostgreSQL");
check(/url\s*=\s*env\("DATABASE_URL"\)/.test(schema), "Prisma still uses DATABASE_URL");
check(!/db\s+(push|migrate|reset)/i.test(packageJson.scripts.build || ""), "Build contains no database push/migrate/reset");
check(!/sqlite/i.test(schema), "Schema contains no SQLite provider");
check(/officiallyEnded\s*===\s*true\s*\?\s*"finished"\s*:\s*"uptodate"/.test(engine), "Finished requires an explicitly ended work");
check(/legacy whole-show flag[\s\S]*must never by itself prove/.test(engine), "Legacy Finished/watched flags cannot prove completion");
check(/state === "finished"[\s\S]*watched: true/.test(engine), "Only Finished maps the whole show to watched=true");
check(/state === "uptodate" \|\| state === "watching"[\s\S]*watched: false/.test(engine), "Up To Date and Watching are not whole-show watched");
check(/nextIsDueOrReleased/.test(engine), "Same-day episode release boundary is handled");
check(/ON(?:GOING)?_TV_META_TTL_MS\s*=\s*5 \* 60 \* 1000/.test(statusServer), "Ongoing TV metadata refreshes every five minutes");
check(/cached\.nextEpisode[\s\S]*isEpisodeReleased/.test(statusServer), "Cache is invalidated when the next episode air date arrives");
check(/hasUnwatchedReleasedEpisode/.test(trackingRoute), "Haven't Watched is based on a released unwatched episode");
check(/"havent-watched": snapshot\.predicates\.hasUnwatchedReleasedEpisode/.test(trackingRoute), "Haven't Watched filter uses the released-episode predicate");
check(/if \(stateVerified\)/.test(trackingRoute) && /repairShowIfNeeded\([\s\S]*derived\.verified/.test(trackingRoute), "Background display repair applies derived progress only when TMDB state is verified");
check(/refetchInterval:\s*5 \* 60 \* 1000/.test(hooks), "TV tracking/progress refetches while the app is open");
check(/setInterval\([\s\S]*5 \* 60 \* 1000/.test(providers), "Global provider triggers periodic server reconciliation");
check(/visibilitychange/.test(providers) && /online/.test(providers) && /focus/.test(providers), "Reconciliation runs on return, reconnect and focus");
check(/getTvRatingEligibility/.test(mediaUpdateRoute), "Direct whole-series rating writes use server eligibility");
check(/TV_RATING_LOCKED_UNTIL_ENDED/.test(eligibility), "Ongoing whole-series rating returns a dedicated lock code");
check(/isWholeSeriesRatingEligible/.test(eligibility)
  && /officiallyEnded\s*===\s*true/.test(ratingRules)
  && /watchedEpisodes\s*>=\s*args\.totalEpisodes/.test(ratingRules), "Full-series rating requires ended + every final episode watched");
check(/mediaType === "tv"[\s\S]*getTvRatingEligibility/.test(ratingRoute), "Legacy title-rating API cannot bypass the TV lock");
check(/deferredSeriesRatings/.test(importRoute) && /lockedSeriesRatingsSkipped/.test(importRoute), "Import cannot bypass the whole-series rating lock");
check(/intentionally disabled/.test(legacyBackupScript) && !/db\.media\.createMany/.test(legacyBackupScript), "Legacy direct backup importer cannot bypass TV state/rating rules");
check(/status: itemType === "series" \? "not_started"/.test(importRoute), "Imported stale Finished TV status is not trusted");
check(/EPISODE_RATING_PREFIX/.test(episodeRating) && /\$\{season\}:\$\{episode\}/.test(episodeRating), "Episode ratings have independent per-episode identities");
check(/EPISODE_RATING_REQUIRES_RELEASE/.test(ratingRoute), "Episode rating requires the episode to have aired");
check(/EPISODE_RATING_REQUIRES_WATCHED/.test(ratingRoute), "Episode rating requires the episode to be watched");
check(/mediaType:\s*"episode"/.test(hooks), "Client saves episode ratings through the independent episode scope");
check(/does not rate the whole series or change episode progress/.test(detailView), "Episode rating dialog explains independence");
check(/disabled=\{!released \|\| !isWatched/.test(detailView), "Episode rating unlocks only after release and watch");
check(/disabled=\{!canRateShow\}/.test(detailView) && /Rating locked/.test(detailView), "Ongoing whole-series rating button is visibly locked");
check(/displayedShowRating = canRateShow \? myRating : null/.test(detailView), "Invalid legacy whole-series ratings are hidden while locked");
check(/trackingStatus === "finished" && show\._isEndedByTmdb === true/.test(trackingView), "TV Tracking exposes a full-show rating only for verified Finished rows");
const libraryCounts = read("src/lib/library-counts.ts");
check(/eligibleTitleRatingWhere/.test(libraryStats) && /eligibleTitleRatingWhere/.test(mediaStats) && /type: "series", status: "finished"/.test(libraryCounts), "Stats exclude ongoing full-series ratings through the canonical count service");

// Parse every TS/TSX file with the locally-installed TypeScript compiler.
try {
  // Resolve the TypeScript compiler from the project's node_modules so the
  // checker works regardless of the host's global install path. `require`
  // is created at the top of this file via createRequire because this is
  // an ESM (.mjs) module.
  let compiler;
  try {
    compiler = require.resolve("typescript/lib/typescript.js");
  } catch {
    try {
      compiler = require.resolve("typescript/lib/typescript.cjs");
    } catch {
      const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
      compiler = resolve(globalRoot, "typescript/lib/typescript.js");
    }
  }
  const parser = `
    const fs=require('fs'),path=require('path'),ts=require(${JSON.stringify(compiler)});
    let files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\\.(ts|tsx)$/.test(e.name))files.push(p)}})('src');
    let errors=[];for(const f of files){const o=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:f,reportDiagnostics:true});for(const d of o.diagnostics||[])errors.push(f+': '+ts.flattenDiagnosticMessageText(d.messageText,' '));}
    if(errors.length){console.error(errors.join('\\n'));process.exit(1)} console.log(files.length);
  `;
  const parsed = execFileSync(process.execPath, ["-e", parser], { cwd: root, encoding: "utf8" }).trim();
  passes.push(`${parsed} TypeScript/TSX files parsed without syntax diagnostics`);
} catch (error) {
  failures.push(`TypeScript syntax parse failed: ${error?.stderr?.toString?.() || error}`);
}

// Run executable pure-logic assertions without installing dependencies.
try {
  execFileSync(process.execPath, ["--experimental-strip-types", "scripts/test-tvm-06-09.ts"], { cwd: root, stdio: "pipe" });
  passes.push("TVM-06/07/08/09 pure-logic tests passed");
} catch (error) {
  failures.push(`Pure-logic tests failed: ${error?.stderr?.toString?.() || error}`);
}

// Whitespace/conflict scan works both inside and outside a Git checkout.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const absolute = resolve(dir, name);
    if (["node_modules", ".next"].includes(name)) return [];
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}
let scannedTextFiles = 0;
let conflictFiles = [];
for (const absolute of walk(root)) {
  const file = relative(root, absolute);
  if (!/\.(ts|tsx|mjs|js|json|md|sh|prisma)$/.test(file)) continue;
  scannedTextFiles++;
  const content = readFileSync(absolute, "utf8");
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(content)) conflictFiles.push(file);
}
check(conflictFiles.length === 0, `${scannedTextFiles} text files contain no merge-conflict markers`);
if (conflictFiles.length) failures.push(`Conflict files: ${conflictFiles.join(", ")}`);

for (const message of passes) console.log(`PASS: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\nTVM-06/07/08/09 verification failed (${failures.length} failure(s)).`);
  process.exit(1);
}
console.log(`\nTVM-06/07/08/09 verification passed (${passes.length} checks).`);
