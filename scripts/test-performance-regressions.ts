#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath: string) => readFileSync(`${root}${relativePath}`, "utf8");

const appShell = read("src/components/app-shell.tsx");
assert.doesNotMatch(
  appShell,
  /if\s*\(!routeReady\)\s*{\s*return\s*\(/,
  "AppShell must not hide the first paint behind route hydration",
);
assert.match(
  appShell,
  /const view = routeReady \? storedView : normalizedInitialRoute\.view/,
  "The server and first client render must use the normalized URL route",
);
assert.match(appShell, /<MotionConfig reducedMotion="user">/, "Framer Motion must honor the OS motion preference globally");
assert.match(appShell, /scrollPositions = useRef\(new Map<number, number>\(\)\)/);
assert.match(appShell, /MAX_SAVED_SCROLL_ENTRIES = 50/, "Remembered routes must stay bounded in long sessions");
assert.match(appShell, /window\.history\.scrollRestoration = "manual"/);
assert.match(appShell, /pendingPopIndex\.current = browserIndex/);
assert.match(appShell, /popIndex === navigationIndex[\s\S]*?scrollTo\(\{ top: savedTop/);

const mediaCard = read("src/components/media/media-card.tsx");
assert.doesNotMatch(mediaCard, /from "framer-motion"|<motion\.article/, "Every poster card must remain free of per-card Framer Motion work");
assert.match(mediaCard, /export const MediaCard = memo\(/, "Stable cards should be memoized");
assert.match(
  mediaCard,
  /compactActions && \(\s*<MediaCardActions/,
  "Mutation and dialog hooks must only mount for cards that expose actions",
);
assert.match(mediaCard, /fill\s+variant="poster"\s+sizes={imageSizes}/, "Poster cards must send responsive image sizing hints");
assert.match(
  mediaCard,
  /onPointerDown={[\s\S]*?event\.preventDefault\(\)[\s\S]*?onClick=/,
  "Mouse and pen menus must defer opening until a shelf gesture resolves as a click",
);

const curated = read("src/components/media/home-curated-sections.tsx");
assert.match(curated, /const CURATED_ITEM_LIMIT = 12/);
assert.equal(
  [...curated.matchAll(/<DeferredCuratedGroup estimatedRows=/g)].length,
  3,
  "Curated Home requests must remain split into three viewport-driven batches",
);
assert.match(curated, /rootMargin: "350px 0px"/);
assert.match(curated, /contentVisibility: "auto"/);
assert.match(curated, /<CuratedRowsPlaceholder rows=\{estimatedRows\}/);
assert.doesNotMatch(curated, /\.slice\(0, 20\)/, "Curated shelves must not regress to 20 mounted cards each");

const genreRecommendations = read("src/components/media/genre-recommendations.tsx");
assert.match(genreRecommendations, /const GENRE_ITEM_LIMIT = 12/);
assert.match(genreRecommendations, /const RATED_SAMPLE_LIMIT = 120/);
assert.match(genreRecommendations, /<DeferredRecommendationRow ready=/);
assert.match(genreRecommendations, /compactCards=\{false\}/, "Home recommendation cards must not mount per-card action hooks");
assert.match(genreRecommendations, /<RecommendationRowsPlaceholder rows=\{3\}/);
assert.doesNotMatch(genreRecommendations, /limit: 500|\.slice\(0, 20\)/);

const home = read("src/components/views/home-view.tsx");
assert.match(home, /const HOME_ROW_ITEM_LIMIT = 12/);
assert.match(home, /items=\{items\.slice\(0, HOME_ROW_ITEM_LIMIT\)\}/);
assert.ok(
  [...home.matchAll(/\.slice\(0, HOME_ROW_ITEM_LIMIT\)\.map/g)].length >= 6,
  "Home must only request library state for cards it can render",
);

const watchNext = read("src/components/views/watch-next-view.tsx");
const watchNextRoute = read("src/app/api/watch-next/route.ts");
const tvStatusServer = read("src/lib/tv-status-server.ts");
const tmdbClient = read("src/lib/tmdb.ts");
assert.doesNotMatch(
  watchNext,
  /useQueries|seasonQueries|useTvSeason|seasonDetail|\/season\//,
  "Watch Next must not issue one client request per season",
);
assert.equal(
  [...watchNext.matchAll(/\buseQuery\(/g)].length,
  1,
  "Watch Next must keep a single client query for its server-built queue",
);
assert.match(watchNext, /fetch\(withUserId\(new URL\("\/api\/watch-next"/);
assert.match(watchNextRoute, /getTvSeasonDetail/);
assert.match(watchNextRoute, /Promise\.allSettled/);
assert.match(watchNextRoute, /WATCH_NEXT_SEASON_ENRICHMENT_LIMIT = 8/);
assert.match(
  watchNextRoute,
  /\.values\(\)\]\.slice\(0, WATCH_NEXT_SEASON_ENRICHMENT_LIMIT\)/,
  "Watch Next must cap optional server-side season enrichment",
);
assert.match(watchNextRoute, /WATCH_NEXT_SEASON_TIMEOUT_MS = 1_200/);
assert.match(
  watchNextRoute,
  /getTvSeasonDetail\([\s\S]*?\{ timeoutMs: WATCH_NEXT_SEASON_TIMEOUT_MS \}/,
  "Every Watch Next season enrichment request must use the short deadline",
);
assert.match(
  tvStatusServer,
  /getTvSeasonDetail\([\s\S]*?options\?: TmdbRequestOptions[\s\S]*?tmdb\.seasonDetail\([\s\S]*?options\)/,
  "The season service must forward the per-request deadline",
);
assert.match(
  tmdbClient,
  /seasonDetail:[\s\S]*?options\?: TmdbRequestOptions[\s\S]*?tmdbFetch<SeasonDetail>[\s\S]*?options\)/,
  "TMDB season requests must accept the forwarded deadline",
);
assert.match(
  tmdbClient,
  /const timeoutMs = resolveTmdbTimeoutMs\(options\.timeoutMs\)[\s\S]*?setTimeout\(\(\) => controller\.abort\(\), timeoutMs\)/,
  "The forwarded TMDB deadline must control the request abort timer",
);
assert.match(
  tmdbClient,
  /Math\.min\(TMDB_TIMEOUT_MS, Math\.max\(TMDB_MIN_TIMEOUT_MS/,
  "Per-request TMDB deadlines must stay inside the safe global bounds",
);
assert.match(watchNextRoute, /episodeName:[\s\S]*episodeAirDate:[\s\S]*episodeRuntime:/);

const globalStyles = read("src/app/globals.css");
assert.doesNotMatch(
  globalStyles,
  /\.tvtime-media-poster\s*\{[^}]*transform:\s*translateZ\(0\)/s,
  "Poster cards must not permanently allocate one GPU layer each",
);
assert.match(globalStyles, /\.tvtime-media-row\s*{[^}]*content-visibility:\s*auto/s);
assert.match(globalStyles, /\.animate-fade-in-up\s*{\s*animation:\s*fade-in-up 180ms/);

console.info("Performance regression checks passed.");
