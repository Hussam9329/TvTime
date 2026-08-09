#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const counts = read("src/lib/library-counts.ts");
const home = read("src/components/views/home-view.tsx");
const css = read("src/app/globals.css");

const checks = [
  [/const movieWatchlistAll = count\(\(entry\) => entry\.item\.type === "movie" && isPlanned\(entry\)\)/, "All-world movie watchlist counter is missing"],
  [/const watchedMoviesAll = count\(\(\{ item \}\) => item\.type === "movie" && item\.watched\)/, "All-world watched movie counter is missing"],
  [/const seriesAll = count\(\(\{ item \}\) => item\.type === "series"\)/, "All-world TV counter is missing"],
  [/const animeTitles = count\(\(\{ world \}\) => world === "anime"\)/, "Complete Anime collection counter is missing"],
  [/const arabicMovies = count\(\(\{ world \}\) => world === "arabic-movies"\)/, "Complete Arabic Movies counter is missing"],
  [/const arabicShows = count\(\(\{ world \}\) => world === "arabic-tv"\)/, "Complete Arabic TV counter is missing"],
  [/const asianMovies = count\(\(\{ world \}\) => world === "asian-movies"\)/, "Complete Asian Movies counter is missing"],
  [/const asianShows = count\(\(\{ world \}\) => world === "asian-tv"\)/, "Complete Asian TV counter is missing"],
  [/label="All Movie Watchlists"[\s\S]{0,100}counts\.movieWatchlistAll/, "Home does not use the all-world movie watchlist counter"],
  [/label="All Movies Watched"[\s\S]{0,100}counts\.watchedMoviesAll/, "Home does not use the all-world watched movie counter"],
  [/label="All TV Shows"[\s\S]{0,100}counts\.seriesAll/, "Home does not use the all-world TV counter"],
  [/label="Episodes Watched"[\s\S]{0,100}counts\.watchedEpisodes/, "Home does not expose the global watched episode count"],
  [/label="Asian Movies"[\s\S]{0,140}setView\("asian-movies"\)/, "Home is missing the Asian Movies statistics card"],
  [/label="Asian TV"[\s\S]{0,140}setView\("asian-tv"\)/, "Home is missing the Asian TV statistics card"],
  [/label="Watch time"[\s\S]{0,100}watchTime\?\.totalHours/, "Home lost the global watch-time card"],
];

const failures = checks.filter(([pattern]) => !pattern.test(pattern.source.includes("label=") ? home : counts));
if (/useTvTrackingCounts\("standard"\)/.test(home)) failures.push([/./, "Home still sources its TV card from standard-world tracking only"]);
if (/Ready when you are|Open Watch Next|tvtime-watch-next-cta/.test(home)) failures.push([/./, "Removed Home Continue Watching button still exists in runtime code"]);
if (/tvtime-watch-next-cta/.test(css)) failures.push([/./, "Removed Home Continue Watching button still has dead CSS"]);

if (failures.length > 0) {
  for (const [, message] of failures) console.error(`FAIL: ${message}`);
  process.exit(1);
}

console.log("PASS: Home statistics cards cover every movie and TV world without standard-world-only totals");
