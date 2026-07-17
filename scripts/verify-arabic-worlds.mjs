#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const passes = [];
const failures = [];
const check = (condition, message) => (condition ? passes : failures).push(message);

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260712150000_arabic_media_worlds/migration.sql");
const arabicLib = read("src/lib/arabic-media.ts");
const navigation = read("src/lib/navigation.ts");
const shell = read("src/components/app-shell.tsx");
const header = read("src/components/layout/header.tsx");
const shortcuts = read("src/components/layout/keyboard-shortcuts.tsx");
const arabicMovies = read("src/components/views/arabic-movies-view.tsx");
const arabicTv = read("src/components/views/arabic-tv-view.tsx");
const collection = read("src/components/views/collection-world-view.tsx");
const trackingApi = read("src/app/api/tv-tracking/route.ts");
const trackingView = read("src/components/views/tv-tracking-view.tsx");
const tvReleaseApi = read("src/app/api/tv/calendar/route.ts");
const releaseSchedule = read("src/components/views/movie-release-schedule.tsx");
const movieCalendarApi = read("src/app/api/arabic-movies/calendar/route.ts");
const movieSchedule = read("src/components/views/arabic-movie-schedule.tsx");
const discoverCatalog = read("src/components/views/arabic-discover-catalog.tsx");
const discover = read("src/components/views/discover-view.tsx");
const home = read("src/components/views/home-view.tsx");
const search = read("src/components/views/search-view.tsx");
const mediaCard = read("src/components/media/media-card.tsx");
const findOrCreate = read("src/app/api/media/find-or-create/route.ts");
const mediaApi = read("src/app/api/media/route.ts");
const mediaPatch = read("src/app/api/media/[id]/route.ts");
const mediaStates = read("src/app/api/media/states/route.ts");
const watchedEpisodesRoute = read("src/app/api/library/watched-episodes/route.ts");
const counts = read("src/lib/library-counts.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const importRoute = read("src/app/api/library/import/route.ts");
const exportRoute = read("src/app/api/library/export/route.ts");
const dedup = read("src/app/api/admin/dedup-media/route.ts");
const backfill = read("scripts/backfill-arabic-media.mjs");
const recently = read("src/app/api/media/recently/route.ts");
const schemaVerifier = read("scripts/verify-required-schema.mjs");
const tmdb = read("src/lib/tmdb.ts");
const packageJson = JSON.parse(read("package.json"));

check(/isArabic\s+Boolean\s+@default\(false\)/.test(schema), "Media stores explicit Arabic-world membership");
check(/originalLanguage\s+String\?/.test(schema), "Media stores original language metadata");
check(/originCountries\s+String\[\]\s+@default\(\[\]\)/.test(schema), "Media stores origin-country metadata");
check(/@@index\(\[userId, isArabic\]\)/.test(schema), "Arabic membership has a user-scoped index");
check(/ADD COLUMN "isArabic" BOOLEAN NOT NULL DEFAULT false/.test(migration), "Migration adds Arabic membership additively");
check(/Media_media_world_exclusive_check/.test(migration) && /NOT \("isArabic" AND "isAnime"\)/.test(migration), "Migration prevents a row belonging to Arabic and Anime simultaneously");
check(!/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i.test(migration), "Arabic migration contains no destructive data command");

check(/ARABIC_LANGUAGE_CODE = "ar"/.test(arabicLib), "Arabic detection uses the canonical language code");
check(/ARAB_COUNTRY_CODES/.test(arabicLib) && /"IQ"/.test(arabicLib) && /"EG"/.test(arabicLib), "Arabic detection includes Arab-origin productions");
check(/detectIsArabic/.test(arabicLib) && /isArabicMediaItem/.test(arabicLib), "One shared detector serves persisted and TMDB media");

check(/\| "arabic-movies"/.test(navigation) && /\| "arabic-tv"/.test(navigation), "Navigation has independent Arabic Movies and Arabic TV views");
check(/return "\/arabic\/movies"/.test(navigation) && /return "\/arabic\/tv"/.test(navigation), "Arabic worlds use shareable direct URLs");
check(/cleanPath === "\/arabic\/movies"/.test(navigation) && /cleanPath === "\/arabic\/tv"/.test(navigation), "Direct Arabic URLs survive refresh and browser history");
check(/view === "arabic-movies"[\s\S]*<ArabicMoviesView/.test(shell), "App shell renders Arabic Movies independently");
check(/view === "arabic-tv"[\s\S]*<ArabicTvView/.test(shell), "App shell renders Arabic TV independently");
check(/view: "arabic-movies"/.test(read("src/app/arabic/movies/page.tsx")), "Arabic Movies direct route initializes the correct view");
check(/view: "arabic-tv"/.test(read("src/app/arabic/tv/page.tsx")), "Arabic TV direct route initializes the correct view");
check(/Arabic Movies/.test(header) && /Arabic TV/.test(header), "Header exposes both Arabic worlds");
check(/Go to Arabic Movies/.test(shortcuts) && /Go to Arabic TV/.test(shortcuts), "Keyboard navigation reaches both Arabic worlds");

check(/My Arabic Movies/.test(arabicMovies) && /Discover/.test(arabicMovies) && /Releases/.test(arabicMovies), "Arabic Movies has its own library, discovery and release schedule");
check(/Tracking/.test(arabicTv) && /Discover/.test(arabicTv) && /Releases/.test(arabicTv), "Arabic TV has its own tracking, discovery and releases");
check(/world="arabic-movies"/.test(arabicMovies), "Arabic Movies reads its dedicated collection world");
check(/world="arabic"/.test(arabicTv), "Arabic TV reads its dedicated tracking world");
check(/ReleaseSchedule/.test(arabicTv) && /originalLanguage="ar"/.test(arabicTv), "Arabic TV uses the shared Arabic-only release schedule");

check(/"arabic-movies"[\s\S]{0,500}isArabic:\s*"true"/.test(collection), "Arabic Movies queries only Arabic records");
check(/movies:\s*\{[\s\S]*?isArabic:\s*"false"/.test(collection), "Standard Movies excludes Arabic records");
check(/anime:\s*\{[\s\S]*?isArabic:\s*"false"/.test(collection), "Anime excludes Arabic records");
check(/Move to Arabic Movies|To Arabic Movies/.test(collection), "Collection UI can correct a title into Arabic Movies without duplication");
check(/isArabic:\s*true,\s*isAnime:\s*false/.test(collection), "Moving to Arabic Movies enforces world exclusivity");

check(/world === "arabic"/.test(trackingApi) && /isArabic:\s*world === "arabic"/.test(trackingApi), "TV Tracking API separates standard and Arabic shows at the source");
check(/worldParam !== "standard" && worldParam !== "arabic"/.test(trackingApi), "TV Tracking rejects unsupported world values");
check(/world:\s*"standard"\s*\|\s*"arabic"/.test(hooks), "Client TV Tracking contract carries its world explicitly");
check(/To Arabic TV/.test(trackingView) && /Moved to Arabic TV/.test(trackingView), "Standard TV can be corrected into Arabic TV");
check(/Moved to TV Shows/.test(trackingView), "Arabic TV can be corrected back into standard TV");

check(/original_language/.test(tvReleaseApi) && /first_air_date/.test(tvReleaseApi), "TV release API supports language-filtered premiere dates");
check(/mediaType="tv"/.test(arabicTv) && /language="ar"/.test(arabicTv), "Arabic TV releases use TV details and Arabic localization");
check(/forcedMediaType=\{mediaType\}/.test(releaseSchedule), "Shared release cards keep the correct media type");
check(/original_language:\s*"ar"/.test(movieCalendarApi), "Arabic movie release API requests Arabic-language releases");
check(/primary_release_date/.test(tmdb), "TMDB discovery supports bounded movie release dates");
check(/Earlier|Later/.test(movieSchedule) && /release/.test(movieSchedule.toLowerCase()), "Arabic Movies has an independent navigable release schedule");

check(/originalLanguage:\s*"ar"/.test(discoverCatalog), "Arabic discovery uses Arabic original-language filtering");
check(/voteCount:\s*0/.test(discoverCatalog), "Arabic discovery does not discard less-voted regional titles");
check(/enabled:\s*kind === "movie"/.test(discoverCatalog) && /enabled:\s*kind === "tv"/.test(discoverCatalog), "Arabic discovery performs only the relevant request");
check(/!isArabicMediaItem\(media\)/.test(discover), "Standard Discover excludes Arabic titles");
check((home.match(/!isArabicMediaItem/g) || []).length >= 3, "Standard Home rows exclude Arabic titles");
check(/type: "movie", watched: true, isArabic: false/.test(recently), "Home recently watched excludes Arabic Movies at the database query");
check(/type: "series", isArabic: false/.test(recently) && /showId: \{ in: showIds \}/.test(recently), "Home recently watched includes episodes only from non-Arabic series");

check(/"arabic-movies"/.test(search) && /"arabic-tv"/.test(search), "Global search offers Arabic Movies and Arabic TV filters");
check(/filter === "all"\s*\?\s*allResults/.test(search), "Global search All remains inclusive");
check(/filter === "movie"[\s\S]{0,180}!isArabicMediaItem\(result\)/.test(search), "Standard movie search filter excludes Arabic Movies");
check(/filter === "tv"[\s\S]{0,180}!isArabicMediaItem\(result\)/.test(search), "Standard TV search filter excludes Arabic TV");
check(/isArabicMediaItem\(result\)/.test(search), "Arabic search filters use shared classification logic");
check(/overflow-x-auto/.test(search), "Search filters remain usable on mobile widths");
check(/Arabic Movie/.test(mediaCard) && /Arabic TV/.test(mediaCard), "Search and discovery cards identify the Arabic world visibly");

check(/detectIsArabic/.test(findOrCreate), "Find-or-create classifies Arabic media from authoritative metadata");
check(/isArabic:\s*detectedArabic/.test(findOrCreate), "New Media records persist Arabic membership");
check(/detectedArabic \? false/.test(findOrCreate) || /detectedArabic[\s\S]{0,120}isAnime/.test(findOrCreate), "New Media records keep Arabic and Anime mutually exclusive");
check(/isArabic/.test(mediaApi) && /where\.isArabic/.test(mediaApi), "Media API can filter Arabic membership server-side");
check(/if \(data\.isArabic\) data\.isAnime = false/.test(mediaPatch), "Media updates enforce Arabic/Anime exclusivity");
check(/isArabic:\s*true/.test(mediaStates) && /isArabic:\s*row\.isArabic/.test(mediaStates), "Batched card states return persisted Arabic membership");
check(/classificationFromMetadata/.test(watchedEpisodesRoute) && /isArabic: classification\.isArabic/.test(watchedEpisodesRoute), "Direct episode tracking classifies newly created Arabic or Anime series");
check(/canonicalMediaPoster\(metadata\.posterPath\)/.test(watchedEpisodesRoute), "Direct episode tracking stores a canonical show poster");

for (const field of ["watchlistArabicMovies", "watchedArabicMovies", "watchlistArabicShows", "notStartedArabicShows", "watchingArabicShows", "finishedArabicShows", "followingArabicShows"]) {
  check(counts.includes(field), `Central counts expose ${field}`);
}
check(/type:\s*"movie",\s*isAnime:\s*false,\s*isArabic:\s*false/.test(counts), "Standard movie counters exclude Arabic and Anime");
check(/type:\s*"series",\s*isAnime:\s*false,\s*isArabic:\s*false/.test(counts), "Standard TV counters exclude Arabic and Anime");

check(/version:\s*4/.test(exportRoute), "Library export version records Arabic classification metadata");
check(/isArabic/.test(importRoute) && /originalLanguage/.test(importRoute) && /originCountries/.test(importRoute), "Library import preserves Arabic classification metadata");
check(/shouldPromoteArabic/.test(importRoute), "Import conservatively promotes older Arabic records without destructive demotion");
check(/isArabic/.test(dedup) && /originCountries/.test(dedup), "Media dedup merges Arabic classification metadata");

check(/const apply = process\.argv\.includes\("--apply"\)/.test(backfill), "Arabic backfill is dry-run by default");
check(/if \(apply &&/.test(backfill), "Arabic backfill writes only after explicit --apply");
check(!/deleteMany|DROP|TRUNCATE/i.test(backfill) && !/prisma\.media\.delete/.test(backfill), "Arabic backfill contains no destructive database operation");
check(/TMDB_API_KEY is required/.test(backfill), "Arabic backfill fails closed without TMDB credentials");
check(backfill.indexOf("TMDB_API_KEY is required") < backfill.indexOf("new PrismaClient"), "Arabic backfill validates credentials before opening a database client");
check(/hasArabicColumn/.test(schemaVerifier) && /hasMediaWorldConstraint/.test(schemaVerifier), "Production schema guard verifies Arabic columns and exclusivity");
check(packageJson.scripts?.["db:backfill:arabic"] === "node scripts/backfill-arabic-media.mjs", "Package exposes the reviewed Arabic backfill command");
check(packageJson.scripts?.["verify:arabic"] === "node scripts/verify-arabic-worlds.mjs", "Package exposes Arabic-world verification");

check(/process\.env\.TMDB_API_KEY\?\.trim\(\) \|\| ""/.test(tmdb), "TMDB client reads its key only from the environment");
check(!/(?:api_key|TMDB_API_KEY)\s*[=:]\s*["'][A-Za-z0-9_-]{20,}["']/i.test(tmdb), "TMDB client contains no embedded API key");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".git"].includes(name)) return [];
    const absolute = resolve(dir, name);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}
const conflicts = [];
for (const absolute of walk(root)) {
  const file = relative(root, absolute).replaceAll("\\", "/");
  if (!/\.(?:ts|tsx|mjs|js|json|md|prisma|sql)$/.test(file)) continue;
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(readFileSync(absolute, "utf8"))) conflicts.push(file);
}
check(conflicts.length === 0, "No merge-conflict markers exist");

for (const message of passes) console.log(`PASS: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\nArabic worlds verification failed (${failures.length} failure(s), ${passes.length} passed).`);
  process.exit(1);
}
console.log(`\nArabic worlds verification passed (${passes.length} checks).`);
