#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);
const passed = [];
const failed = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
const check = (condition, message) => (condition ? passed : failed).push(message);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (["node_modules", ".next", ".git"].includes(entry)) return [];
    const absolute = resolve(dir, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

const profile = read("src/components/profile/profile-dialog.tsx");
const clearRoute = read("src/app/api/library/clear/route.ts");
const store = read("src/lib/store.ts");
const providers = read("src/components/providers.tsx");
const clientUser = read("src/lib/client-user.ts");
const watchedEpisodes = read("src/app/api/library/watched-episodes/route.ts");
const tracking = read("src/app/api/tv-tracking/route.ts");
const repair = read("src/lib/tv-status-repair.ts");
const collection = read("src/components/views/collection-world-view.tsx");
const counts = read("src/lib/library-counts.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const shortcuts = read("src/components/layout/keyboard-shortcuts.tsx");
const shell = read("src/components/app-shell.tsx");
const pkg = JSON.parse(read("package.json"));
const schemaVerifier = read("scripts/verify-required-schema.mjs");

check(/"x-confirm-delete":\s*"DELETE EVERYTHING"/.test(profile), "Clear-all UI sends the exact destructive-operation confirmation token");
check(/confirm\s*!==\s*"DELETE EVERYTHING"/.test(clearRoute), "Clear-all API rejects requests without the exact confirmation token");
check(/db\.\$transaction\(\[/.test(clearRoute), "Clear-all deletes canonical collection data atomically");

check(/return DEFAULT_USER_ID/.test(clientUser), "Client API identity is the canonical default user");
check(/userId:\s*DEFAULT_USER_ID/.test(store), "Navigation/profile store starts with the canonical user identity");
check(/partialize:\s*\(state\)\s*=>\s*\(\{\s*userName:/.test(store), "Random or stale user identifiers are not persisted");
check(/merge:[\s\S]*userId:\s*DEFAULT_USER_ID/.test(store), "Previously persisted random user identifiers are corrected during hydration");
check(/hydrateCanonicalProfile/.test(providers) && /\/api\/user/.test(providers), "Display name is hydrated from the same server user as the library");

check(/persist:\s*false/.test(watchedEpisodes), "Legacy whole-show snapshots are read without database writes during GET");
check(/_virtualLegacySnapshot/.test(watchedEpisodes), "Legacy completion is represented immediately as a virtual episode snapshot");
check((watchedEpisodes.match(/db\.\$transaction\(async \(tx\)/g) || []).length >= 2, "Legacy snapshot persistence and episode changes are transactional");
check((watchedEpisodes.match(/tx\.watchedEpisode\.createMany/g) || []).length >= 2, "Legacy episodes are materialized before add/remove mutations");
check(/attempted && !legacySnapshot\.verified/.test(watchedEpisodes), "Episode mutations fail closed when legacy completion cannot be verified");
check(/verified:\s*boolean/.test(repair) && /verified:\s*false/.test(repair), "Legacy snapshot repair exposes explicit verification status");

check(/if \(derived\.verified\)[\s\S]*tvStateToMediaPatch/.test(watchedEpisodes), "Unverified TMDB state is never persisted from episode mutations");
check(/derived\.verified \? derived\.state : persistedState/.test(watchedEpisodes), "Episode responses preserve the last persisted state during TMDB failure");
check(/const effectiveState = derived\.verified[\s\S]*persisted \?\?/.test(tracking), "TV tracking display preserves persisted state when TMDB verification fails");

check(/type CollectionTab = "watchlist" \| "not-started" \| "watching" \| "watched"/.test(collection), "Anime collection models Watchlist, Not Started, In Progress and Watched separately");
check(/value="not-started"/.test(collection) && /Not Started/.test(collection), "Anime not-started titles remain visible in their own tab");
check(/status:\s*"not_started",\s*watched:\s*"false",\s*tracked:\s*"true"/.test(collection), "Anime Not Started requires explicit following membership and no watched progress");
check(/value="watching"/.test(collection) && /In Progress/.test(collection), "Anime in-progress is visible and selectable");
check(/status:\s*"watching,uptodate"/.test(collection), "Anime In Progress includes only actual episode-progress states");
check(!/status:\s*"not_started,watching,uptodate"/.test(collection), "Anime In Progress no longer mislabels Not Started titles");
check(/notStartedAnime/.test(counts) && /isFollowing:\s*true/.test(counts) && /status:\s*"not_started"/.test(counts), "Anime Not Started badge is counted from explicit following membership");
check(/watchingAnime/.test(counts) && /status:\s*\{\s*in:\s*\["watching",\s*"uptodate"\]/.test(counts), "Anime In Progress badge counts only Watching and Up To Date");
check(/notStartedAnime\?:\s*number/.test(hooks) && /watchingAnime\?:\s*number/.test(hooks), "Client stats contract exposes both Anime state counters");
check(!/finished-anime/.test(tracking) && !/finishedAnime/.test(hooks), "TV Tracking no longer exposes the unreachable Finished Anime category");
check(/INVALID_TV_TRACKING_CATEGORY/.test(tracking) && /status:\s*400/.test(tracking), "Unknown TV Tracking categories fail explicitly instead of silently returning All");

const sequenceAt = shortcuts.indexOf('lastKeyRef.current === "g"');
const standaloneAt = shortcuts.indexOf('e.key.toLowerCase() === "s"');
check(sequenceAt >= 0 && standaloneAt > sequenceAt, "g+s navigation is resolved before the standalone search shortcut");
check(/view === "media" && <MediaView/.test(shell), "The legacy ?view=media route renders a real view instead of a blank shell");

check(/verify-required-schema\.mjs/.test(pkg.scripts?.build || ""), "Production build verifies the required database contract before Next.js build");
check(pkg.scripts?.["db:migrate:status"]?.includes("prisma migrate status"), "A read-only migration status command is available");
check(pkg.scripts?.["db:migrate:deploy"]?.includes("prisma migrate deploy"), "Reviewed migrations have an explicit deployment command");
check(/Media\.isFollowing/.test(schemaVerifier), "Schema guard verifies the dedicated following field");
check(/Media_userId_type_tmdbId_key/.test(schemaVerifier), "Schema guard verifies the canonical Media identity constraint");
check(/type" = 'tv'|"type" = 'tv'/.test(schemaVerifier), "Schema guard rejects unnormalized legacy TV identities");
check(!/\b(prisma\s+db\s+push|prisma\s+migrate\s+reset)\b/i.test(pkg.scripts?.build || ""), "Build contains no destructive schema command");
check(pkg.scripts?.["verify:all"] === "node scripts/verify-all.mjs", "One comprehensive verification command covers the maintained project checks");

check(/errorBody\?\.error \|\| "Failed to unmark episode"/.test(hooks), "Episode removal surfaces the server's safety error to the user");
check(/payload\?\.user\?\.name/.test(profile), "Profile UI stores the server-normalized display name");

try {
  let compiler;
  try {
    compiler = require.resolve("typescript/lib/typescript.js");
  } catch {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    compiler = resolve(globalRoot, "typescript/lib/typescript.js");
  }
  const parser = `
    const fs=require('fs'),path=require('path'),ts=require(${JSON.stringify(compiler)});
    let files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(['node_modules','.next','.git'].includes(e.name))continue;if(e.isDirectory())walk(p);else if(/\\.(ts|tsx)$/.test(e.name))files.push(p)}})('src');
    let errors=[];for(const f of files){const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:f,reportDiagnostics:true});for(const d of out.diagnostics||[]){if(d.category===ts.DiagnosticCategory.Error)errors.push(f+': '+ts.flattenDiagnosticMessageText(d.messageText,' '));}}
    if(errors.length){console.error(errors.join('\\n'));process.exit(1)}console.log(files.length);
  `;
  const count = execFileSync(process.execPath, ["-e", parser], { cwd: root, encoding: "utf8" }).trim();
  passed.push(`${count} TypeScript/TSX files parsed without syntax diagnostics`);
} catch (error) {
  failed.push(`TypeScript syntax parse failed: ${error?.stderr?.toString?.() || error}`);
}

for (const test of ["scripts/test-tv-status-engine.ts", "scripts/test-tvm-06-09.ts"]) {
  try {
    execFileSync(process.execPath, ["--experimental-strip-types", test], { cwd: root, stdio: "pipe" });
    passed.push(`${test} passed`);
  } catch (error) {
    failed.push(`${test} failed: ${error?.stderr?.toString?.() || error}`);
  }
}

const conflicts = [];
for (const absolute of walk(root)) {
  const path = relative(root, absolute).replaceAll("\\", "/");
  if (!/\.(?:ts|tsx|mjs|js|json|md|prisma|sql)$/.test(path)) continue;
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(readFileSync(absolute, "utf8"))) conflicts.push(path);
}
check(conflicts.length === 0, "No merge-conflict markers exist");
if (conflicts.length) failed.push(`Conflict markers found in: ${conflicts.join(", ")}`);

for (const message of passed) console.log(`PASS: ${message}`);
if (failed.length > 0) {
  for (const message of failed) console.error(`FAIL: ${message}`);
  console.error(`\nUser-facing integrity verification failed (${failed.length} failure(s)).`);
  process.exit(1);
}
console.log(`\nUser-facing integrity verification passed (${passed.length} checks).`);
