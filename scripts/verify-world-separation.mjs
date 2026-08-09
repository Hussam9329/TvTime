#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const passes = [];
const failures = [];
const check = (condition, message) => (condition ? passes : failures).push(message);

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
const header = read("src/components/layout/header.tsx");
const shell = read("src/components/app-shell.tsx");
const store = read("src/lib/store.ts");
const navigation = read("src/lib/navigation.ts");
const collection = read("src/components/views/collection-world-view.tsx");
const movies = read("src/components/views/movies-view.tsx");
const anime = read("src/components/views/anime-view.tsx");
const tvShows = read("src/components/views/tv-tracking-view.tsx");
const tvApi = read("src/app/api/tv-tracking/route.ts");
const counts = read("src/lib/library-counts.ts");
const tvWorldClassification = read("src/lib/tv-world-classification.ts");
const classificationResolver = read("src/lib/media-classification-resolver-server.ts");
const shortcuts = read("src/components/layout/keyboard-shortcuts.tsx");
const home = read("src/components/views/home-view.tsx");
const profile = read("src/components/profile/profile-dialog.tsx");
const statsView = read("src/components/views/stats-view.tsx");

check(/provider\s*=\s*"postgresql"/.test(schema), "Prisma remains PostgreSQL");
check(/url\s*=\s*env\("DATABASE_URL"\)/.test(schema), "DATABASE_URL remains the only database source");
check(!/sqlite/i.test(schema), "No SQLite source was introduced");

const navOrder = [
  { source: 'view: "movies", icon: Film', label: "Movies" },
  { source: 'view: "tv-shows", icon: Clapperboard', label: "TV Shows" },
  { source: 'view: "anime", icon: Sparkles', label: "Anime" },
];
let navAt = -1;
for (const entry of navOrder) {
  const at = header.indexOf(entry.source);
  check(at > navAt, `Top navigation contains ${entry.label} in the requested order`);
  navAt = at;
}
check(!/label:\s*"TV Track"/.test(header), "TV Track label was fully replaced by TV Shows");
check(!/label:\s*"Library"/.test(header), "Library was removed from top navigation");
check(/xl:hidden/.test(header) && /hidden xl:flex/.test(header), "Expanded navigation remains responsive on smaller desktop widths");

check(/\| "movies"/.test(navigation) && /\| "tv-shows"/.test(navigation) && /\| "anime"/.test(navigation), "Navigation state has separate Movies, TV Shows and Anime worlds");
check(!/\| "library"/.test(navigation) && !/\| "tv-tracking"/.test(navigation), "Old Library and TV Track view names are retired");
check(!/libraryTab|setLibraryTab|LibraryTab/.test(store), "Obsolete mixed Library navigation state was removed");
check(/view === "movies"[\s\S]*<MoviesView/.test(shell), "App shell renders the Movies world");
check(/view === "tv-shows"[\s\S]*<TvShowsView/.test(shell), "App shell renders the TV Shows world");
check(/view === "anime"[\s\S]*<AnimeView/.test(shell), "App shell renders the Anime world");

check(/world="movies"/.test(movies), "Movies page is backed by the shared collection world");
check(/world="anime"/.test(anime), "Anime page is backed by the shared collection world");
check(/title:\s*"Movies"[\s\S]*type:\s*"movie"[\s\S]*isAnime:\s*"false"/.test(collection), "Movies reads only non-anime movie records");
check(/title:\s*"Anime"[\s\S]*isAnime:\s*"true"/.test(collection), "Anime reads only anime records");
check(!/title:\s*"Anime"[\s\S]{0,260}type:\s*"series"/.test(collection), "Anime can contain anime movies and anime series without mixing with other worlds");
check(/<TabsTrigger value="watchlist"/.test(collection) && /<TabsTrigger value="watched"/.test(collection), "Movies retain Watchlist and Watched tabs");
check(/<TabsTrigger value="not-started"/.test(collection) && /<TabsTrigger value="watching"/.test(collection), "Anime adds distinct Not Started and In Progress tabs");
check(!/Watchlist TV|Watched TV|My Library/.test(collection), "Movies and Anime contain no legacy mixed Library tabs");
check(/status:\s*"planned"/.test(collection) && /watched:\s*"true"/.test(collection), "Watchlist and Watched use explicit canonical states");
check(/status:\s*"planned",\s*watched:\s*"false"/.test(collection), "Watchlist tabs explicitly exclude watched titles");
check(!/To Anime/.test(tvShows), "TV Shows keeps obsolete manual Anime classification removed");
check(!/To TV Shows|To Movies/.test(collection), "Anime keeps obsolete manual cross-world classification removed");

check(
  /resolveGeneralMediaClassifications/.test(tvApi)
    && (tvApi.match(/recordMatchesTvWorld/g) || []).length >= 3
    && /if \(classification\.isAnime\) return false/.test(tvWorldClassification)
    && /return classification\.world === world/.test(tvWorldClassification)
    && /batchReadDbClassifications/.test(classificationResolver),
  "TV Shows API excludes Anime and separates standard, Arabic and Asian TV through canonical metadata",
);
check(!/label="Finished Anime"/.test(tvShows) && !/label:\s*"Finished Anime"/.test(tvShows), "TV Shows no longer exposes an Anime filter");
check(/isArabic \? "المسلسلات العربية" : world === "asian" \? "Asian TV Shows" : "TV Shows"/.test(tvShows), "TV Shows page uses the requested world-specific name");

check(/const movies = count\(\(\{ world \}\) => world === "movies"\)/.test(counts), "Standard movie counters use the shared world predicate");
check(/const watchlistAnime = count\(\(entry\) => entry\.world === "anime" && isPlanned\(entry\)\)/.test(counts), "Anime Watchlist counter covers the dedicated Anime world");
check(/const watchedAnime = count\(\(\{ item, world \}\) => world === "anime" && item\.watched\)/.test(counts), "Anime Watched counter covers the dedicated Anime world");
check(/world === "standard-tv" && item\.isFollowing/.test(counts), "TV Shows following counter uses explicit membership and the shared standard-world predicate");
check(/notStartedAnime/.test(counts) && /item\.status === "not_started"/.test(counts) && /item\.isFollowing/.test(counts), "Anime Not Started is counted separately from progress");
check(/watchingAnime/.test(counts) && /isWatching\(item\.status\)/.test(counts), "Anime In Progress contains only real progress states");

check(/Go to Movies/.test(shortcuts) && /Go to TV Shows/.test(shortcuts) && /Go to Anime/.test(shortcuts), "Keyboard shortcuts navigate to all three worlds");
check(
  /setView\("stats"\)/.test(home) &&
    /setView\("anime"\)/.test(home) &&
    /setView\("asian-movies"\)/.test(home) &&
    /setView\("asian-tv"\)/.test(home) &&
    /setView\("arabic-movies"\)/.test(home) &&
    /setView\("arabic-tv"\)/.test(home),
  "Home global and world statistics cards route to their matching destinations",
);
check(!/Library exported|Your library|library data|Library breakdown/.test(profile + statsView), "Visible settings and stats use Collection terminology instead of the retired Library page name");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".git"].includes(name)) return [];
    const absolute = resolve(dir, name);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

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

const conflictFiles = [];
for (const absolute of walk(root)) {
  const file = relative(root, absolute);
  if (!/\.(?:ts|tsx|mjs|js|json|md|sh|prisma)$/.test(file)) continue;
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(readFileSync(absolute, "utf8"))) conflictFiles.push(file);
}
check(conflictFiles.length === 0, "No merge-conflict markers exist");

for (const message of passes) console.log(`PASS: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\nWorld separation verification failed (${failures.length} failure(s)).`);
  process.exit(1);
}
console.log(`\nWorld separation verification passed (${passes.length} checks).`);
