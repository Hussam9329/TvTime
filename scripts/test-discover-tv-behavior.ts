#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesDiscoverWorld } from "../src/lib/discover-world.ts";

const read = (path: string) => readFileSync(path, "utf8");
const view = read("src/components/views/discover-view.tsx");
const hooks = read("src/hooks/use-tmdb.ts");
const filteredRoute = read("src/app/api/discover/filtered/route.ts");
const tmdbRoute = read("src/app/api/tmdb/[...path]/route.ts");
const tmdb = read("src/lib/tmdb.ts");

assert.match(view, /effectiveIsTV && showMe === "all" \? "all"/, "TV Everything must use cursor-backed classified discovery");
assert.match(view, /world: resultWorld/, "Discover must send its media world to the API");
assert.match(filteredRoute, /matchesDiscoverWorld\(item, mediaType, world\)/, "TV results must be classified before a result page is filled");
assert.match(filteredRoute, /if \(showMe === "all"\) return true/, "Everything must not depend on personal seen state");

const standardMixedProduction = {
  id: 55083,
  name: "Hostages",
  original_language: "en",
  origin_country: ["US", "SG"],
  genre_ids: [18],
};
const asianDrama = { id: 1, name: "Drama", original_language: "ko", origin_country: ["KR"], genre_ids: [18] };
const anime = { id: 2, name: "Anime", original_language: "ja", origin_country: ["JP"], genre_ids: [16] };
const arabicShow = { id: 3, name: "Arabic", original_language: "ar", origin_country: ["IQ"], genre_ids: [18] };

assert.equal(matchesDiscoverWorld(standardMixedProduction, "tv", "standard"), true, "Mixed US/Asian productions belong to standard TV");
assert.equal(matchesDiscoverWorld(standardMixedProduction, "tv", "asian"), false, "Hostages must never leak into Asian TV");
assert.equal(matchesDiscoverWorld(asianDrama, "tv", "asian"), true, "Asian drama must remain in Asian TV");
assert.equal(matchesDiscoverWorld(anime, "tv", "anime"), true, "Anime must remain in Anime Discover");
assert.equal(matchesDiscoverWorld(anime, "tv", "asian"), false, "Anime must not leak into Asian live-action TV");
assert.equal(matchesDiscoverWorld(arabicShow, "tv", "arabic"), true, "Arabic shows must remain in Arabic TV");
assert.equal(matchesDiscoverWorld(arabicShow, "tv", "standard"), false, "Arabic shows must not leak into standard TV");

assert.match(hooks, /rating_max: params\.maxRating/, "Catalogue requests must forward maximum score");
assert.match(tmdbRoute, /vote_average_lte: queryParams\.rating_max/, "TMDB API route must forward maximum score");
assert.match(tmdb, /p\["vote_average\.lte"\] = params\.vote_average_lte/, "TMDB client must apply maximum score upstream");
assert.doesNotMatch(view, /filtered = filtered\.filter\(\(m\) => \(m\.vote_average/, "Maximum score must not sparsify a page in the browser");

assert.match(view, /sortBy === "popularity\.desc"/, "Country priority must not override explicit TV sort choices");
assert.match(view, /setTimeout\(\(\) => setDebouncedKeywords/, "Keyword discovery must be debounced");
assert.match(view, /advancedFilterCount/, "Advanced-filter badge must use the corrected filter count");

console.log("PASS: TV Discover classification, ranges, sorting, score bounds, and request behavior");
