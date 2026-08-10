#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesDiscoverWorld } from "../src/lib/discover-world.ts";
import { buildTmdbKeywordFilter } from "../src/lib/tmdb.ts";
import { isStrictMiniSeries } from "../src/lib/tv-format.ts";

const read = (path: string) => readFileSync(path, "utf8");
const view = read("src/components/views/discover-view.tsx");
const hooks = read("src/hooks/use-tmdb.ts");
const filteredRoute = read("src/app/api/discover/filtered/route.ts");
const tmdbRoute = read("src/app/api/tmdb/[...path]/route.ts");
const tmdb = read("src/lib/tmdb.ts");

assert.match(view, /effectiveIsTV && showMe === "all" \? "all"/, "TV Everything must use cursor-backed classified discovery");
assert.match(view, /world: resultWorld/, "Discover must send its media world to the API");
assert.match(filteredRoute, /matchesMediaCollectionWorld\(item, collectionWorld\)/, "TV results must use the central collection-world classifier before a result page is filled");
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

assert.match(view, /filterAndPrioritizeMediaCollectionWorldItems\(allResults, resultCollectionWorld\)/, "Every TV sort must use world priority while preserving the selected sort inside each priority group");
assert.match(view, /setTimeout\(\(\) => setDebouncedKeywords/, "Keyword discovery must be debounced");
assert.match(view, /advancedFilterCount/, "Advanced-filter badge must use the corrected filter count");

assert.match(view, /label: isArabicTv \? "مسلسل قصير" : "Mini Series"/, "TV Discover must expose a Mini Series quick filter");
assert.match(view, /label: isArabicTv \? "أنثولوجيا" : "Anthology"/, "TV Discover must expose an Anthology quick filter");
assert.match(view, /tvFormat === presetId \? "all" : presetId/, "TV format quick filters must toggle without resetting other filters");
assert.match(hooks, /tv_format.*params\.tvFormat/, "TV format must reach the Discover API");
assert.match(filteredRoute, /series_type: tvFormat === "miniseries" \? 2/, "Mini Series must use TMDB TV type 2");
assert.match(filteredRoute, /filterStrictMiniSeriesResults\(response\.results, language\)/, "Mini Series must verify the current season count");
assert.equal(isStrictMiniSeries({ number_of_seasons: 1 }), true, "A one-season TMDB mini-series remains eligible");
assert.equal(isStrictMiniSeries({ number_of_seasons: 5 }), false, "A five-season show must not leak into Mini Series");
assert.equal(isStrictMiniSeries({ number_of_seasons: null }), false, "Unknown season counts must fail closed");
assert.match(filteredRoute, /resolveTmdbKeywordIds\("anthology", "en-US"\)/, "Anthology must resolve the canonical TMDB keyword");
assert.match(tmdb, /p\.with_type = params\.series_type/, "TMDB TV discovery must send with_type");
assert.equal(
  buildTmdbKeywordFilter([[10, 11, 10], [20, 21]]),
  "10|11,20|21",
  "User keywords and Anthology must combine as AND groups while alternatives remain OR",
);

console.log("PASS: TV Discover classification, ranges, sorting, score bounds, and request behavior");
