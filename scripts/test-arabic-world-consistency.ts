#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARABIC_COUNTRY_PRIORITY,
  arabicMediaCountryPriority,
  detectIsArabic,
  filterAndPrioritizeArabicMediaItems,
} from "../src/lib/arabic-media.ts";
import { classifyMediaWorld } from "../src/lib/media-world-classification.ts";

assert.equal(
  detectIsArabic({ originalLanguage: "ar", originCountry: ["EG"] }),
  true,
  "an Arabic-language Egyptian work must belong to the Arabic world",
);
assert.equal(ARABIC_COUNTRY_PRIORITY[0], "EG", "the single Arabic country-order definition must start with Egypt");
assert.equal(
  detectIsArabic({ originalLanguage: "ar", originCountry: ["US"] }),
  false,
  "an Arabic-tagged foreign production must not leak into Arabic lists",
);
assert.equal(
  detectIsArabic({ originalLanguage: "en", originCountry: ["EG"] }),
  false,
  "an Egyptian location or co-production alone must not make a foreign-language work Arabic",
);
assert.equal(
  detectIsArabic({ originalLanguage: "ar", originCountry: [] }),
  true,
  "sparse TMDB/search results may use the Arabic-language fallback when country data is absent",
);

assert.equal(
  arabicMediaCountryPriority({ origin_country: [], originCountries: ["EG"] }),
  0,
  "all country metadata fields must be merged before calculating Egyptian priority",
);

const mixedCatalogue = [
  { id: "foreign", original_language: "ar", origin_country: ["US"] },
  { id: "tunisian", original_language: "ar", origin_country: ["TN"] },
  { id: "egyptian-1", original_language: "ar", origin_country: ["EG"] },
  { id: "syrian", original_language: "ar", origin_country: ["SY"] },
  { id: "egyptian-2", original_language: "ar", origin_country: ["EG"] },
];
assert.deepEqual(
  filterAndPrioritizeArabicMediaItems(mixedCatalogue).map((item) => item.id),
  ["egyptian-1", "egyptian-2", "syrian", "tunisian"],
  "the canonical Arabic pipeline must filter foreign works, put Egypt first, and preserve secondary order",
);

assert.equal(
  classifyMediaWorld({
    type: "movie",
    isArabic: true,
    originalLanguage: "en",
    originCountries: ["US"],
  }).collectionWorld,
  "movies",
  "canonical movie metadata must demote a stale Arabic flag",
);
assert.equal(
  classifyMediaWorld({
    type: "series",
    isArabic: false,
    originalLanguage: "ar",
    originCountries: ["EG"],
  }).collectionWorld,
  "arabic-tv",
  "canonical metadata must classify Egyptian Arabic series into Arabic TV",
);

const read = (path: string) => readFileSync(path, "utf8");
const centralPipelineConsumers = [
  "src/lib/arabic-discover.ts",
  "src/app/api/discover/filtered/route.ts",
  "src/components/views/discover-view.tsx",
  "src/app/api/media/route.ts",
  "src/app/api/movie-hub/route.ts",
  "src/app/api/tv-tracking/route.ts",
  "src/components/views/tv-hub-overview.tsx",
  "src/app/api/movies/calendar/route.ts",
  "src/app/api/tv/calendar/route.ts",
  "src/components/views/movie-release-schedule.tsx",
  "src/components/views/search-view.tsx",
];
for (const path of centralPipelineConsumers) {
  assert.match(
    read(path),
    /(?:(?:filterAndPrioritize|prioritize)ArabicMediaItems|(?:filterAndPrioritize|prioritize)MediaCollectionWorldItems)/,
    `${path} must consume the central Arabic priority pipeline`,
  );
}

assert.match(
  read("src/components/views/arabic-tv-view.tsx"),
  /releaseCollectionWorld="arabic-tv"/,
  "Arabic TV releases must explicitly use the Arabic TV collection world",
);
assert.match(
  read("src/components/views/movie-release-schedule.tsx"),
  /filterAndPrioritizeMediaCollectionWorldItems\(matchingSearch, collectionWorld\)/,
  "movie and TV releases must share the exact same collection-world pipeline",
);
assert.match(
  read("src/lib/arabic-discover.ts"),
  /ARABIC_COUNTRY_PRIORITY[\s\S]{0,160}filterAndPrioritizeArabicMediaItems[\s\S]*original_language: "ar"/,
  "the canonical Arabic discovery loader must force Arabic original language",
);

console.log("PASS: one Arabic pipeline filters foreign titles and keeps Egypt first across Discover, Library, Releases, Overview, and Search");
