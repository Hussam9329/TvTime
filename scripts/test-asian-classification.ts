import assert from "node:assert/strict";
import { isAsianMediaItem } from "../src/lib/asian-media.ts";
import { classifyTvWorld, recordMatchesTvWorld } from "../src/lib/tv-world-classification.ts";
import {
  classifyMediaWorld,
  recordMatchesMediaClassification,
} from "../src/lib/media-world-classification.ts";

const hostages = {
  title: "Hostages",
  originalLanguage: "en",
  originCountries: ["SG", "US"],
  classificationComplete: true,
};

assert.equal(
  isAsianMediaItem(hostages),
  false,
  "TMDB 55083 Hostages is a mixed SG + US production and must remain in standard TV",
);
assert.equal(
  isAsianMediaItem({ originalLanguage: "hi", originCountries: ["US"] }),
  false,
  "an explicit non-Asian origin country must override an Asian-language value",
);
assert.equal(
  isAsianMediaItem({ originalLanguage: "he", originCountries: ["IL"] }),
  false,
  "Israeli productions are outside the configured Asian TV collection",
);
assert.equal(
  isAsianMediaItem({ originalLanguage: "en", originCountries: ["kr"] }),
  true,
  "origin-country matching must normalize lower-case TMDB data",
);
assert.equal(
  isAsianMediaItem({ originalLanguage: "ko", originCountries: ["KR", "US"] }),
  false,
  "one non-Asian origin country must keep a mixed production out of Asian TV",
);
assert.equal(
  isAsianMediaItem({ originalLanguage: "ja", originCountries: ["JP", "KR"] }),
  true,
  "multi-country productions remain Asian when every declared country is Asian",
);
assert.equal(
  isAsianMediaItem({ originalLanguage: "ko", originCountries: [] }),
  true,
  "language remains a fallback when origin-country data is missing",
);

assert.deepEqual(classifyTvWorld({ ...hostages, isAnime: true, isArabic: true }), {
  world: "standard",
  isArabic: false,
  isAnime: false,
  isAsian: false,
}, "complete TMDB classification must override stale persisted flags");
assert.equal(recordMatchesTvWorld(hostages, "standard"), true);
assert.equal(recordMatchesTvWorld(hostages, "asian"), false);
assert.equal(recordMatchesTvWorld({
  title: "Korean Drama",
  originalLanguage: "ko",
  originCountries: ["KR"],
  classificationComplete: true,
}, "asian"), true);

const staleHostagesMedia = {
  type: "series",
  title: "Hostages",
  originalLanguage: "ko",
  originCountries: [],
  isAnime: false,
  isArabic: false,
};
const authoritativeHostagesMedia = {
  ...staleHostagesMedia,
  originalLanguage: "en",
  originCountries: ["SG", "US"],
  genres: ["Drama"],
  classificationComplete: true,
};
assert.equal(
  classifyMediaWorld(staleHostagesMedia).collectionWorld,
  "asian-tv",
  "the regression fixture must represent the stale Media row that leaked into Asian TV",
);
assert.equal(
  classifyMediaWorld(authoritativeHostagesMedia).collectionWorld,
  "standard-tv",
  "the general Media classifier must move an authoritatively US show to standard TV",
);
assert.equal(
  recordMatchesMediaClassification(authoritativeHostagesMedia, { isAsian: true }),
  false,
  "every My Media classification filter must reject Hostages from Asian TV",
);
assert.equal(
  recordMatchesMediaClassification(authoritativeHostagesMedia, {
    isAnime: false,
    isArabic: false,
    isAsian: false,
  }),
  true,
  "the same general classifier must include Hostages in standard TV",
);

console.log("Asian TV classification regression tests passed.");
