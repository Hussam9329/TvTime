#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTitle, pickArabicTitle } from "../src/lib/tmdb.ts";

assert.equal(
  getTitle({
    id: 1,
    title: "Welad Rizk",
    original_title: "ولاد رزق",
    original_language: "ar",
  } as any),
  "ولاد رزق",
  "Arabic catalogue cards must prefer an Arabic-script title",
);

assert.equal(
  pickArabicTitle({ title: "The Blue Elephant", originalTitle: "الفيل الأزرق" }, "movie", "The Blue Elephant"),
  "الفيل الأزرق",
  "Persisted Arabic movies must support the database originalTitle field",
);

assert.equal(
  pickArabicTitle({ name: "Paranormal", originalName: "ما وراء الطبيعة" }, "tv", "Paranormal"),
  "ما وراء الطبيعة",
  "Persisted Arabic shows must support the database originalName field",
);

const read = (path: string) => readFileSync(path, "utf8");
const collection = read("src/components/views/collection-world-view.tsx");
const tracking = read("src/components/views/tv-tracking-view.tsx");
const tvOverview = read("src/components/views/tv-hub-overview.tsx");
const discover = read("src/components/views/discover-view.tsx");
const movieDetail = read("src/components/views/movie-detail-view.tsx");
const tvDetail = read("src/components/views/tv-detail-view.tsx");
const mediaRow = read("src/components/media/media-row.tsx");
const movieHub = read("src/components/views/movie-hub-view.tsx");

assert.match(collection, /pickArabicTitle\(item,[\s\S]{0,100}item\.title\)/, "Arabic Movies Library cards must resolve their visible title in Arabic");
assert.match(tracking, /isArabic\s*\?\s*pickArabicTitle\(show, "tv", show\.title\)/, "Arabic TV Library cards must resolve their visible title in Arabic");
assert.match(tvOverview, /function mediaTitle\(item: MediaItem\)[\s\S]{0,80}return getTitle\(item\)/, "Arabic TV Overview shelves must use the shared Arabic title resolver");
assert.match(discover, /useMovieGenres\(tmdbLanguage\)/, "Arabic Movies Discover must request Arabic genre labels");
assert.match(discover, /useTvGenres\(tmdbLanguage\)/, "Arabic TV Discover must request Arabic genre labels");
assert.match(discover, /isArabic \? "الفلاتر" : "Filters"/, "Arabic Discover headings must stay localized");
assert.match(movieDetail, /isArabicMovie \? "نظرة عامة" : "Overview"/, "Arabic movie profiles must localize their section headings");
assert.match(movieDetail, /isArabicMovie \? "اقتراحات لك" : "Recommendations"/, "Arabic movie profile lists must use Arabic headings");
assert.match(tvDetail, /isArabicShow \? "المواسم والحلقات" : "Seasons & Episodes"/, "Arabic TV profiles must localize seasons and episodes headings");
assert.match(tvDetail, /isArabicShow \? "اقتراحات لك" : "Recommendations"/, "Arabic TV profile lists must use Arabic headings");
assert.match(mediaRow, /isArabic \? "مختارة لك" : "Curated for you"/, "Shared rows with Arabic headings must not show an English subheading");
assert.match(movieHub, /TONIGHT_OPTIONS_AR/, "Arabic Movies quick-pick list must use Arabic labels");

console.log("PASS: Arabic-world titles and section headings stay Arabic across overviews, libraries, discovery and profiles");
