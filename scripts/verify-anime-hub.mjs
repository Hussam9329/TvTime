#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const page = read("src/components/views/anime-view.tsx");
const overview = read("src/components/views/anime-hub-overview.tsx");
const route = read("src/app/api/anime/hub/route.ts");
const mediaRoute = read("src/app/api/media/route.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const collection = read("src/components/views/collection-world-view.tsx");
const discover = read("src/components/views/discover-view.tsx");
const releases = read("src/components/views/movie-release-schedule.tsx");
const styles = read("src/app/globals.css");

const checks = [];
const check = (condition, message) => checks.push({ condition, message });

check(/value="overview"/.test(page) && /value="library"/.test(page) && /value="discover"/.test(page) && /value="releases"/.test(page), "Anime exposes the same four-world tabs as Movies and TV Shows");
check(/AnimeHubOverview/.test(page) && /tvtime-movie-hub__titlebar/.test(page) && /tvtime-movie-hub__summary/.test(page), "Anime uses the professional shared world shell and Overview");
check(/useAnimeHub/.test(hooks) && /\/api\/anime\/hub/.test(hooks) && /queryKey: \["lib", "anime-hub"/.test(hooks), "Anime Hub has a user-aware query that refreshes with library mutations");
check(/resolveUserId\(req\)/.test(route) && /getOrCreateUser/.test(route), "Anime Hub resolves the canonical request owner");
check(/genres: \[ANIMATION_GENRE\]/.test(route) && /original_language: "ja"/.test(route) && /matchesDiscoverWorld\(item, mediaType, "anime"\)/.test(route), "Anime catalogue is restricted to Japanese animation instead of Japanese live action");
check(/original_language: "ja"/.test(route) && /language: "en-US"/.test(route) && /originalLanguage="ja"/.test(page) && /language="en-US"/.test(page) && /isAnime \? "en-US" as const/.test(discover), "Anime keeps Japanese-origin classification while every catalogue title requests English localization");
check(/englishTitleByTmdbId/.test(route) && /englishAnimeTitleById/.test(mediaRoute) && /tvMetadataCache\.findMany/.test(mediaRoute), "Existing saved Anime series reuse the batched English metadata title without per-card requests or DB rewrites");
check(/Promise\.allSettled\(Object\.values\(requests\)\)/.test(route) && !/tmdb\.(?:movieSummary|tvSummary|movieDetail|tvDetail)\(item/.test(route), "Anime Hub batches bounded shelves without per-card TMDB detail fan-out");
check(/item\.watched \|\| item\.userRating != null/.test(route) && /seenKeys/.test(route) && /STARTED_TV_STATUSES/.test(overview), "Anime spotlight excludes watched, rated and started titles on server and client");
check(/Continue Watching/.test(overview) && /Your Anime Watchlist/.test(overview) && /Next Episodes/.test(overview) && /Airing Today/.test(overview) && /currentSeason/.test(overview) && /New & Noteworthy/.test(overview) && /Hidden Gems/.test(overview) && /Upcoming Anime/.test(overview) && /Recently Watched/.test(overview), "Anime Overview includes every planned professional shelf");
check(/tvMetadataCache/.test(route) && /nextEpisodeAirDate/.test(route) && /nextEpisodes/.test(route) && /AnimeUpcomingEpisodes/.test(overview), "Anime Overview exposes cached upcoming episodes without per-show network fan-out");
check(/animeMediaKind/.test(collection) && /Anime type/.test(collection) && /Filter Anime library by media type/.test(collection), "Anime Library separates All, Series and Movies");
check(/onDiscover \? onDiscover\(\) : setView\("discover"\)/.test(collection) && /Discover Anime/.test(collection), "Anime Library empty states navigate to Anime Discover");
check(/No matching results/.test(collection) && /Your watchlist is empty/.test(collection) && /No Anime series are in progress/.test(collection), "Anime Library empty states use coherent English copy");
check(/world === "anime" \? "trakora:anime-library-layout" : "trakora:movie-library-layout"/.test(collection), "Anime keeps a Grid/List preference independent from the established movie worlds");
check(/Trending Anime/.test(discover) && /Hidden Anime Gems/.test(discover) && /Anime Classics/.test(discover), "Anime Discover exposes Anime-specific quick-pick labels");
check(/collectionWorld\?:[\s\S]*"anime"/.test(releases) && /collectionWorld === "anime"[\s\S]*filter\(isAnimeMediaItem\)/.test(releases), "Anime Releases applies a defensive Anime-only classification filter");
check(/seasonal\?: boolean/.test(releases) && /offset \* 3/.test(releases) && /seasonal/.test(page), "Anime Releases uses true Winter, Spring, Summer and Fall calendar windows");
check(/\.tvtime-movie-hub\[data-world="anime"\]/.test(styles) && /\.tvtime-anime-library-type/.test(styles) && /\.tvtime-anime-next__scroller/.test(styles), "Anime has its own accent and responsive library and next-episode controls");

const failures = checks.filter((entry) => !entry.condition);
for (const entry of checks) console.log(`${entry.condition ? "PASS" : "FAIL"}: ${entry.message}`);
if (failures.length > 0) process.exit(1);
console.log(`\nAnime Hub verification passed (${checks.length} checks).`);
