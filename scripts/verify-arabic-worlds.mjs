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
const movieHub = read("src/components/views/movie-hub-view.tsx");
const arabicTv = read("src/components/views/arabic-tv-view.tsx");
const tvWorldPage = read("src/components/views/tv-world-page-view.tsx");
const collection = read("src/components/views/collection-world-view.tsx");
const trackingApi = read("src/app/api/tv-tracking/route.ts");
const trackingView = read("src/components/views/tv-tracking-view.tsx");
const tvReleaseApi = read("src/app/api/tv/calendar/route.ts");
const releaseSchedule = read("src/components/views/movie-release-schedule.tsx");
const movieCalendarApi = read("src/app/api/arabic-movies/calendar/route.ts");
const generalMovieCalendarApi = read("src/app/api/movies/calendar/route.ts");
const movieHubApi = read("src/app/api/movie-hub/route.ts");
const arabicDiscover = read("src/lib/arabic-discover.ts");
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
const mediaWorldClassification = read("src/lib/media-world-classification.ts");
const tvWorldClassification = read("src/lib/tv-world-classification.ts");
const classificationResolver = read("src/lib/media-classification-resolver-server.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const importRoute = read("src/app/api/library/import/route.ts");
const exportRoute = read("src/app/api/library/export/route.ts");
const importValidation = read("src/lib/library-import-validation.ts");
const transferTypes = read("src/lib/library-transfer-types.ts");
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
check(
  /const arabicNavItems[\s\S]*view: "arabic-movies"[\s\S]*view: "arabic-tv"/.test(header)
    && (header.match(/arabicNavItems\.map/g) || []).length >= 2,
  "Header exposes both Arabic worlds",
);
check(/Go to Arabic Movies/.test(shortcuts) && /Go to Arabic TV/.test(shortcuts), "Keyboard navigation reaches both Arabic worlds");

check(/world="arabic-movies"/.test(arabicMovies) && /value="library"/.test(movieHub) && /value="discover"/.test(movieHub) && /value="releases"/.test(movieHub) && /CollectionWorldView/.test(movieHub) && /DiscoverView/.test(movieHub) && /ReleaseSchedule/.test(movieHub), "Arabic Movies has its own library, discovery and release schedule through the shared movie hub");
check(
  /TvWorldPageView/.test(arabicTv)
    && /value="library"/.test(tvWorldPage)
    && /value="discover"/.test(tvWorldPage)
    && /value="releases"/.test(tvWorldPage)
    && /TvShowsView/.test(tvWorldPage)
    && /DiscoverView/.test(tvWorldPage)
    && /ReleaseSchedule/.test(tvWorldPage),
  "Arabic TV has its own tracking, discovery and releases",
);
check(/world="arabic-movies"/.test(arabicMovies), "Arabic Movies reads its dedicated collection world");
check(/<DiscoverView[\s\S]*world=\{world\}/.test(movieHub), "Arabic Movies reuses the full Movies Discover experience");
check(/originalLanguage=\{world === "arabic-movies" \? "ar" : undefined\}[\s\S]*language=\{world === "arabic-movies" \? "ar" : undefined\}/.test(movieHub), "Arabic Movies reuses the full Movies release schedule with Arabic-only data");
check(/trackingWorld="arabic"/.test(arabicTv), "Arabic TV reads its dedicated tracking world");
check(/releaseOriginalLanguage="ar"/.test(arabicTv) && /releaseCollectionWorld="arabic-tv"/.test(arabicTv) && /originalLanguage=\{releaseOriginalLanguage\}/.test(tvWorldPage), "Arabic TV uses the shared Arabic-only release schedule and collection world");

check(/"arabic-movies"[\s\S]{0,500}isArabic:\s*"true"/.test(collection), "Arabic Movies queries only Arabic records");
check(/movies:\s*\{[\s\S]*?isArabic:\s*"false"/.test(collection), "Standard Movies excludes Arabic records");
check(/anime:\s*\{[\s\S]*?isArabic:\s*"false"/.test(collection), "Anime excludes Arabic records");
check(!/Move to Arabic Movies|To Arabic Movies/.test(collection), "Obsolete manual Arabic classification controls stay removed");
check(
  /"arabic-movies":\s*\{[\s\S]*?isAnime:\s*"false"[\s\S]*?isArabic:\s*"true"/.test(collection),
  "Arabic Movies collection enforces world exclusivity",
);

check(
  /export type TvWorld = "standard" \| "arabic" \| "asian"/.test(tvWorldClassification)
    && /if \(classification\.isAnime\) return false/.test(tvWorldClassification)
    && /return classification\.world === world/.test(tvWorldClassification)
    && /resolveGeneralMediaClassifications/.test(trackingApi)
    && (trackingApi.match(/filterAndPrioritizeMediaCollectionWorldItems/g) || []).length >= 3
    && /collectionWorldForCatalogue\(world, "tv"\)/.test(trackingApi),
  "TV Tracking API separates standard, Arabic and Asian shows through the canonical classifier",
);
check(/worldParam !== "standard" && worldParam !== "arabic" && worldParam !== "asian"/.test(trackingApi), "TV Tracking rejects unsupported world values");
check(/world\?:\s*"standard"\s*\|\s*"arabic"\s*\|\s*"asian"/.test(hooks), "Client TV Tracking contract carries its world explicitly");
check(!/To Arabic TV|Moved to Arabic TV/.test(trackingView), "Standard TV has no obsolete manual Arabic reclassification control");
check(!/Moved to TV Shows/.test(trackingView), "Arabic TV has no obsolete manual standard-TV reclassification control");

check(/original_language/.test(tvReleaseApi) && /first_air_date/.test(tvReleaseApi), "TV release API supports language-filtered premiere dates");
check(/mediaType="tv"/.test(tvWorldPage) && /releaseLanguage="ar"/.test(arabicTv) && /language=\{releaseLanguage\}/.test(tvWorldPage), "Arabic TV releases use TV details and Arabic localization");
check(/forcedMediaType=\{mediaType\}/.test(releaseSchedule), "Shared release cards keep the correct media type");
check(/original_language:\s*"ar"/.test(movieCalendarApi), "Arabic movie release API requests Arabic-language releases");
check(/ARABIC_COUNTRY_PRIORITY_GROUPS = \[\s*\["EG"\]/.test(arabicLib) && /ARABIC_COUNTRY_PRIORITY/.test(arabicDiscover), "One shared country order gives Egyptian works the highest discovery priority");
check(/discoverArabicShelfByCountryPriority\("movie"/.test(movieHubApi), "Arabic Movies Overview shelves use efficient Egypt-first discovery");
check(/prioritizeMediaCollectionWorldItems/.test(movieHubApi) && /prioritizeMediaCollectionWorldItems/.test(mediaApi), "Arabic Overview and Library use the central world priority pipeline that contains Egyptian priority");
check(/discoverArabicCatalogueByCountryPriority\("movie"/.test(generalMovieCalendarApi) && /filterAndPrioritizeMediaCollectionWorldItems/.test(releaseSchedule), "Arabic Releases retrieve and render Egyptian films first through the central world pipeline");
check(/primary_release_date/.test(tmdb), "TMDB discovery supports bounded movie release dates");
check(/Earlier/.test(releaseSchedule) && /Later/.test(releaseSchedule) && /scheduled releases/.test(releaseSchedule), "Shared release schedule gives Arabic Movies an independently navigable window");

check(/const forcedLang = isAnime \? "ja" : isArabic \? "ar"/.test(discover), "Shared Arabic discovery fixes the original language to Arabic");
check(/const effectiveVoteCount = voteCount/.test(discover), "Discovery applies no implicit vote floor to Arabic or Asian titles");
check(/mediaType: resultMediaType/.test(discover) && /world === "arabic-movies"/.test(discover) && /world === "arabic-tv"/.test(discover), "Shared Arabic discovery selects only the active movie or TV media type");
check(/filterAndPrioritizeMediaCollectionWorldItems\(allResults, resultCollectionWorld\)/.test(discover), "Standard Discover excludes Arabic titles through the exact collection-world pipeline");
check(/onlyArabic:\s*isArabic/.test(discover), "Arabic Seen/Haven't Seen filtering is enforced at the API boundary");
check(/disabled=\{Boolean\(forcedLang\)\}/.test(discover), "Arabic and Anime discovery cannot escape their fixed language world");
check(/filterAndPrioritizeMediaCollectionWorldItems/.test(home) && /"standard-tv"/.test(home) && /"movies"/.test(home), "Standard Home rows exclude Arabic titles through exact collection worlds");
check(
  /resolveGeneralMediaClassifications\(mediaMovies, \{ allowNetwork: false \}\)/.test(recently)
    && /!classifyMediaWorld\(item\)\.isArabic/.test(recently),
  "Home recently watched excludes Arabic Movies through canonical classification",
);
check(
  /resolveGeneralMediaClassifications\(mediaShows, \{ allowNetwork: false \}\)/.test(recently)
    && /const showIds = nonArabicShows/.test(recently)
    && /showId: \{ in: showIds \}/.test(recently),
  "Home recently watched includes episodes only from canonically non-Arabic series",
);

check(/"arabic-movies"/.test(search) && /"arabic-tv"/.test(search), "Global search offers Arabic Movies and Arabic TV filters");
check(/filter === "all"\s*\?\s*allResults/.test(search), "Global search All remains inclusive");
check(/filter === "movie"[\s\S]{0,80}"movies"/.test(search), "Standard movie search maps to the exclusive Movies collection world");
check(/filter === "tv"[\s\S]{0,80}"standard-tv"/.test(search), "Standard TV search maps to the exclusive Standard TV collection world");
check(/filterAndPrioritizeMediaCollectionWorldItems\(allResults, world\)/.test(search), "Arabic search filters use shared collection-world classification logic");
check(/overflow-x-auto/.test(search), "Search filters remain usable on mobile widths");
check(/Arabic Movie/.test(mediaCard) && /Arabic TV/.test(mediaCard), "Search and discovery cards identify the Arabic world visibly");

check(
  /classifyMediaWorld/.test(findOrCreate)
    && /canonicalClassification/.test(findOrCreate)
    && /classificationComplete:\s*hasClassificationMetadata/.test(findOrCreate),
  "Find-or-create classifies Arabic media through the canonical metadata classifier",
);
check(/isArabic:\s*detectedArabic/.test(findOrCreate), "New Media records persist Arabic membership");
check(/detectedArabic \? false/.test(findOrCreate) || /detectedArabic[\s\S]{0,120}isAnime/.test(findOrCreate), "New Media records keep Arabic and Anime mutually exclusive");
check(
  /resolveGeneralMediaClassifications/.test(mediaApi)
    && /recordMatchesMediaClassification/.test(mediaApi),
  "Media API filters Arabic membership through the canonical resolver",
);
check(
  /MEDIA_CLASSIFICATION_IMMUTABLE/.test(mediaPatch)
    && /body\.isAnime !== undefined \|\| body\.isArabic !== undefined/.test(mediaPatch),
  "Media updates cannot bypass automatic Arabic/Anime exclusivity",
);
check(/isArabic:\s*true/.test(mediaStates) && /isArabic:\s*row\.isArabic/.test(mediaStates), "Batched card states return persisted Arabic membership");
check(/classificationFromMetadata/.test(watchedEpisodesRoute) && /isArabic: classification\.isArabic/.test(watchedEpisodesRoute), "Direct episode tracking classifies newly created Arabic or Anime series");
check(/canonicalMediaPoster\(metadata\.posterPath\)/.test(watchedEpisodesRoute), "Direct episode tracking stores a canonical show poster");

for (const field of ["watchlistArabicMovies", "watchedArabicMovies", "watchlistArabicShows", "notStartedArabicShows", "watchingArabicShows", "finishedArabicShows", "followingArabicShows"]) {
  check(counts.includes(field), `Central counts expose ${field}`);
}
check(
  /resolveGeneralMediaClassifications/.test(counts)
    && /classifyMediaWorld\(item\)\.collectionWorld/.test(counts)
    && /world === "movies"/.test(counts),
  "Standard movie counters use the shared canonical world classifier",
);
check(
  /resolveGeneralMediaClassifications/.test(counts)
    && /classifyMediaWorld\(item\)\.collectionWorld/.test(counts)
    && /world === "standard-tv"/.test(counts)
    && /"asian-tv"/.test(mediaWorldClassification)
    && /"arabic-tv"/.test(mediaWorldClassification)
    && /batchReadDbClassifications/.test(classificationResolver),
  "Standard TV counters exclude Arabic, Anime and Asian titles through authoritative classification",
);

check(
  /LIBRARY_BACKUP_VERSION\s*=\s*6/.test(transferTypes)
    && /LIBRARY_BACKUP_VERSION/.test(exportRoute),
  "Library export version records Arabic classification metadata",
);
check(
  /isArabic:\s*strictBoolean/.test(importValidation)
    && /originalLanguage:\s*nullableString/.test(importValidation)
    && /originCountries:\s*stringArray/.test(importValidation),
  "Library import preserves Arabic classification metadata",
);
check(
  /shouldPromoteArabic\s*=\s*detectIsArabic/.test(importValidation)
    && /const isArabic = originalLanguage[\s\S]{0,120}\? shouldPromoteArabic/.test(importValidation),
  "Import lets canonical metadata supersede stale Arabic flags",
);
check(/isArabic/.test(dedup) && /originCountries/.test(dedup), "Media dedup merges Arabic classification metadata");

check(/const apply = process\.argv\.includes\("--apply"\)/.test(backfill), "Arabic backfill is dry-run by default");
check(/if \(apply &&/.test(backfill), "Arabic backfill writes only after explicit --apply");
check(!/deleteMany|DROP|TRUNCATE/i.test(backfill) && !/prisma\.media\.delete/.test(backfill), "Arabic backfill contains no destructive database operation");
check(/TMDB_API_KEY is required/.test(backfill), "Arabic backfill fails closed without TMDB credentials");
check(backfill.indexOf("TMDB_API_KEY is required") < backfill.indexOf("new PrismaClient"), "Arabic backfill validates credentials before opening a database client");
check(
  /Media:\s*\[[\s\S]*"isArabic"[\s\S]*"originalLanguage"[\s\S]*"originCountries"/.test(schemaVerifier)
    && /Media_media_world_exclusive_check/.test(schemaVerifier),
  "Production schema guard verifies Arabic columns and exclusivity",
);
check(packageJson.scripts?.["db:backfill:arabic"] === "node --experimental-strip-types scripts/backfill-arabic-media.mjs", "Package exposes the reviewed Arabic backfill command through the shared classifier");
check(packageJson.scripts?.["verify:arabic"]?.includes("test-arabic-world-consistency.ts") && packageJson.scripts?.["verify:arabic"]?.includes("verify-arabic-worlds.mjs"), "Package exposes behavioral and structural Arabic-world verification");

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
