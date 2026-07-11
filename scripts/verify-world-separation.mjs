#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const sha256 = (path) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const passes = [];
const failures = [];
const check = (condition, message) => (condition ? passes : failures).push(message);

const protectedHashes = {
  "scripts/assert-production-db.mjs": "f4a8214783d8a926a391b27da36102dc2ef0b075e013fd95eca3b5dcd7f53d36",
  "next.config.ts": "6427983b336fdc783833ad08feab538b75286de080701680509663fd27b999c5",
};
for (const [path, expected] of Object.entries(protectedHashes)) {
  check(sha256(path) === expected, `${path} remains on the reviewed infrastructure baseline`);
}

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
const shortcuts = read("src/components/layout/keyboard-shortcuts.tsx");
const home = read("src/components/views/home-view.tsx");
const profile = read("src/components/profile/profile-dialog.tsx");
const statsView = read("src/components/views/stats-view.tsx");

check(/provider\s*=\s*"postgresql"/.test(schema), "Prisma remains PostgreSQL");
check(/url\s*=\s*env\("DATABASE_URL"\)/.test(schema), "DATABASE_URL remains the only database source");
check(!/sqlite/i.test(schema), "No SQLite source was introduced");

const navOrder = [
  'view: "movies", label: "Movies"',
  'view: "tv-shows", label: "TV Shows"',
  'view: "anime", label: "Anime"',
];
let navAt = -1;
for (const entry of navOrder) {
  const at = header.indexOf(entry);
  check(at > navAt, `Top navigation contains ${entry.split('label: ')[1]} in the requested order`);
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
check(/Move to Anime/.test(tvShows) && /isAnime:\s*true/.test(tvShows), "TV Shows can move a misclassified title into Anime without duplicating it");
check(/To TV Shows/.test(collection) && /To Movies/.test(collection), "Anime titles can be moved back to the correct world");

check(/type:\s*"series",\s*\n\s*isAnime:\s*false/.test(tvApi), "TV Shows API excludes Anime at the source");
check(!/label="Finished Anime"/.test(tvShows) && !/label:\s*"Finished Anime"/.test(tvShows), "TV Shows no longer exposes an Anime filter");
check(/>TV Shows<\/h1>/.test(tvShows), "TV Shows page uses the requested name");

check(/type:\s*"movie",\s*isAnime:\s*false/.test(counts), "Movie counters exclude Anime movies");
check(/status:\s*"planned",\s*watched:\s*false,\s*isAnime:\s*true/.test(counts), "Anime Watchlist counter covers the dedicated Anime world");
check(/watched:\s*true,\s*isAnime:\s*true/.test(counts), "Anime Watched counter covers the dedicated Anime world");
check(/type:\s*"series",\s*isAnime:\s*false,\s*isFollowing:\s*true/.test(counts), "TV Shows following counter uses explicit membership and excludes Anime");
check(/notStartedAnime/.test(counts) && /status:\s*"not_started"/.test(counts) && /isFollowing:\s*true/.test(counts), "Anime Not Started is counted separately from progress");
check(/watchingAnime/.test(counts) && /\["watching",\s*"uptodate"\]/.test(counts), "Anime In Progress contains only real progress states");

check(/Go to Movies/.test(shortcuts) && /Go to TV Shows/.test(shortcuts) && /Go to Anime/.test(shortcuts), "Keyboard shortcuts navigate to all three worlds");
check(/setView\("movies"\)/.test(home) && /setView\("tv-shows"\)/.test(home) && /setView\("anime"\)/.test(home), "Home quick actions route to the separated worlds");
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
