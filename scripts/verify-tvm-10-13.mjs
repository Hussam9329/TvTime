#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const passes = [];
const failures = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
const hash = (path) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const check = (condition, message) => (condition ? passes : failures).push(message);

const protectedHashes = {
  "prisma/schema.prisma": "1fbff4160f922dc906471f8a2e3de4eea398287e47a457cc70daab1220d8124d",
  "package.json": "a03766d67ee230ac279405c653f27f8b8b0a7f146e6e8671e48d9b6d0f9b4faf",
  "scripts/assert-production-db.mjs": "f4a8214783d8a926a391b27da36102dc2ef0b075e013fd95eca3b5dcd7f53d36",
  "next.config.ts": "6427983b336fdc783833ad08feab538b75286de080701680509663fd27b999c5",
};
for (const [path, expected] of Object.entries(protectedHashes)) {
  check(hash(path) === expected, `${path} matches the locked TvTime-main (6)(2) baseline`);
}

const schema = read("prisma/schema.prisma");
const pkg = JSON.parse(read("package.json"));
const migration = read("src/lib/legacy-library-migration.ts");
const user = read("src/lib/user.ts");
const counts = read("src/lib/library-counts.ts");
const countsRoute = read("src/app/api/library/counts/route.ts");
const watchlist = read("src/app/api/library/watchlist/route.ts");
const watchedMovies = read("src/app/api/library/watched-movies/route.ts");
const following = read("src/app/api/library/following/route.ts");
const ratings = read("src/app/api/library/ratings/route.ts");
const recently = read("src/app/api/media/recently/route.ts");
const mediaList = read("src/app/api/media/route.ts");
const mediaStats = read("src/app/api/media/stats/route.ts");
const libraryStats = read("src/app/api/library/stats/route.ts");
const trackingApi = read("src/app/api/tv-tracking/route.ts");
const trackingView = read("src/components/views/tv-tracking-view.tsx");
const collectionView = read("src/components/views/collection-world-view.tsx");
const hooks = read("src/hooks/use-tmdb.ts");
const exportRoute = read("src/app/api/library/export/route.ts");
const clearRoute = read("src/app/api/library/clear/route.ts");

check(/provider\s*=\s*"postgresql"/.test(schema), "Prisma remains PostgreSQL");
check(/url\s*=\s*env\("DATABASE_URL"\)/.test(schema), "Prisma remains attached to DATABASE_URL");
check(!/sqlite/i.test(schema), "No SQLite provider was introduced");
check(!/\bprisma\s+db\s+(push|migrate|reset)\b/i.test(pkg.scripts?.build || ""), "Build contains no destructive Prisma command");

check(/db\.\$transaction/.test(migration), "Legacy migration runs in one database transaction");
check(/pg_advisory_xact_lock/.test(migration), "Legacy migration is serialized per user");
check(/tx\.watchlistItem\.findMany/.test(migration), "WatchlistItem is read only by the migration");
check(/tx\.watchedMovie\.findMany/.test(migration), "WatchedMovie is read only by the migration");
check(/tx\.followingShow\.findMany/.test(migration), "FollowingShow is read only by the migration");
check(/mediaType:\s*\{\s*in:\s*\["movie",\s*"tv",\s*"series"\]/.test(migration), "Only title-level Rating rows are migrated");
check(/single title, watched state or title rating failed/.test(migration), "Canonical Media rows are verified before cleanup");
const verifyAt = migration.indexOf("const canonicalRows");
const deleteAt = migration.indexOf("tx.watchlistItem.deleteMany");
check(verifyAt >= 0 && deleteAt > verifyAt, "Legacy rows are deleted only after canonical verification");
check(/migrationPromises/.test(migration), "Migration is idempotently cached per user/process");
check(/isolationLevel:\s*"Serializable"/.test(migration), "Migration uses Serializable isolation");
check(/id:\s*\{\s*in:\s*watchlist\.map/.test(migration) && !/watchlistItem\.deleteMany\(\{\s*where:\s*\{\s*userId/.test(migration), "Cleanup deletes only rows from the verified snapshot");
check(/for \(let pass = 0; pass < 3; pass\+\+\)/.test(migration), "Repeated passes catch and verify rolling-deploy legacy writes");
check(/ensureLegacyLibraryMigrated\(user\.id\)/.test(user), "Every API user initialization completes legacy migration first");
check(/throw new Error\("Legacy library migration could not be verified/.test(user), "Migration failure is fail-closed instead of showing an incomplete library");

const allowedLegacyFiles = new Set([
  "src/lib/legacy-library-migration.ts",
  "scripts/verify-production-db-readonly.mjs",
  "scripts/verify-tvm-10-13.mjs",
]);
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".git"].includes(name)) return [];
    const absolute = resolve(dir, name);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}
const legacyPattern = /(?:db|tx)\.(?:watchlistItem|watchedMovie|followingShow)\./;
const legacyUsers = [];
for (const absolute of [...walk(resolve(root, "src")), ...walk(resolve(root, "scripts"))]) {
  const file = relative(root, absolute).replaceAll("\\", "/");
  if (!/\.(?:ts|tsx|js|mjs)$/.test(file)) continue;
  if (legacyPattern.test(readFileSync(absolute, "utf8")) && !allowedLegacyFiles.has(file)) legacyUsers.push(file);
}
check(legacyUsers.length === 0, "No runtime page/API reads or writes legacy title tables after migration");
if (legacyUsers.length) failures.push(`Unexpected legacy table users: ${legacyUsers.join(", ")}`);

check(/source:\s*"Media"/.test(watchlist) && !/db\.watchlistItem/.test(watchlist), "Watchlist compatibility API is backed only by Media");
check(/source:\s*"Media"/.test(watchedMovies) && !/db\.watchedMovie/.test(watchedMovies), "Watched movies compatibility API is backed only by Media");
check(/source:\s*"Media"/.test(following) && !/db\.followingShow/.test(following), "Following compatibility API is backed only by Media");
check(/Media\.userRating/.test(ratings) && /Rating:episode-only/.test(ratings), "Title ratings use Media while episode ratings remain independent");
check(/episodeRatings/.test(exportRoute) && !/watchlistItems|watchedMovies|followingShows/.test(exportRoute), "Export uses canonical Media plus episode-only data");
check(/media\.deleteMany/.test(clearRoute) && /mediaType:\s*\{\s*startsWith:\s*"episode:"/.test(clearRoute), "Clear removes canonical Media and episode-only records without legacy writes");

check(/status:\s*"planned",\s*\n\s*watched:\s*false/.test(watchlist), "Watchlist API requires Planned and watched=false");
check(/status:\s*"planned",\s*watched:\s*false/.test(counts), "Global Watchlist counters require Planned and watched=false");
check(/if \(status === "planned"\) where\.watched = false/.test(mediaList), "Generic Media listing enforces strict Watchlist semantics");
check(!/userRating\s*:\s*null/.test(watchlist.split("export async function GET")[1]?.split("export async function POST")[0] || ""), "Watchlist is not derived from missing ratings");

check(/getCanonicalLibraryCounts/.test(countsRoute), "Dedicated global counts API uses the canonical count service");
check(/countsAreGlobal:\s*true/.test(countsRoute), "Dedicated counts API explicitly marks counters global");
check(/getCanonicalLibraryCounts/.test(mediaStats) && /countsAreGlobal:\s*true/.test(mediaStats), "Media Stats uses full-library canonical counters");
check(/getCanonicalLibraryCounts/.test(libraryStats) && /countsAreGlobal:\s*true/.test(libraryStats), "Library Stats uses full-library canonical counters");
check(/useLibraryCounts/.test(collectionView), "Movies and Anime tabs display dedicated global counts");
check(/queryKey:\s*\["library-counts"/.test(hooks), "Global counts have their own React Query cache key");
check((hooks.match(/invalidateQueries\(\{ queryKey: \["library-counts"\]/g) || []).length >= 5, "Library counters invalidate after all major mutations");

const exactCategories = ["all", "watchlist", "uptodate", "finished", "finished-anime", "upcoming", "havent-watched", "havent-started"];
for (const category of exactCategories) {
  check(trackingApi.includes(`"${category}"`), `TV Tracking API supports ${category}`);
}
const expectedLabels = ["All", "Watchlist", "Up To Date", "Finished", "Upcoming", "Haven't Watched", "Haven't Started"];
let lastLabelAt = -1;
for (const label of expectedLabels) {
  const index = trackingView.indexOf(`label: "${label}"`);
  check(index > lastLabelAt, `TV Tracking/All contains ${label} in the requested order`);
  lastLabelAt = index;
}
check(/const counts = \{[\s\S]*all:[\s\S]*haventWatched:/.test(trackingApi), "TV Tracking computes every filter count from one snapshot");
check(/countsOnly[\s\S]*countsAreGlobal:\s*true/.test(trackingApi), "TV Tracking counts-only response is global");
check(/const matching =[\s\S]*matching\.slice\(offset, offset \+ limit\)/.test(trackingApi), "TV Tracking counts/filtering happen before pagination");
check(/const snapshot = await buildTrackingSnapshot\(user\.id\)/.test(trackingApi), "TV Tracking list and counters share one canonical snapshot");
check(/Every number is calculated across your complete TV Shows collection/.test(trackingView), "TV Shows explains that badge counts are global");

check(!/watchedMovie|followingShow|watchlistItem/.test(recently), "Recently Watched reads no legacy title table");
check(/source:\s*"Media\+WatchedEpisode"/.test(recently), "Recently Watched declares its canonical sources");

const localStorageImports = [];
for (const absolute of walk(resolve(root, "src"))) {
  const file = relative(root, absolute).replaceAll("\\", "/");
  if (file === "src/lib/local-storage.ts" || !/\.(?:ts|tsx)$/.test(file)) continue;
  if (/from\s+["'][^"']*local-storage["']/.test(readFileSync(absolute, "utf8"))) localStorageImports.push(file);
}
check(localStorageImports.length === 0, "No runtime component imports the old localStorage library source");
if (localStorageImports.length) failures.push(`localStorage imports: ${localStorageImports.join(", ")}`);

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
  const parsed = execFileSync(process.execPath, ["-e", parser], { cwd: root, encoding: "utf8" }).trim();
  passes.push(`${parsed} TypeScript/TSX files parsed without syntax diagnostics`);
} catch (error) {
  failures.push(`TypeScript syntax parse failed: ${error?.stderr?.toString?.() || error}`);
}

for (const test of ["scripts/test-tv-status-engine.ts", "scripts/test-tvm-06-09.ts"]) {
  try {
    execFileSync(process.execPath, ["--experimental-strip-types", test], { cwd: root, stdio: "pipe" });
    passes.push(`${test} passed`);
  } catch (error) {
    failures.push(`${test} failed: ${error?.stderr?.toString?.() || error}`);
  }
}

try {
  if (existsSync(resolve(root, ".git"))) execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
  passes.push("Patch contains no whitespace errors");
} catch (error) {
  failures.push(`git diff --check failed: ${error?.stderr?.toString?.() || error}`);
}

const conflicts = [];
for (const absolute of walk(root)) {
  const file = relative(root, absolute);
  if (!/\.(?:ts|tsx|mjs|js|json|md|sh|prisma)$/.test(file)) continue;
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(readFileSync(absolute, "utf8"))) conflicts.push(file);
}
check(conflicts.length === 0, "No merge-conflict markers exist");
if (conflicts.length) failures.push(`Conflict files: ${conflicts.join(", ")}`);

for (const message of passes) console.log(`PASS: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\nTVM-10/11/12/13 verification failed (${failures.length} failure(s)).`);
  process.exit(1);
}
console.log(`\nTVM-10/11/12/13 verification passed (${passes.length} checks).`);
