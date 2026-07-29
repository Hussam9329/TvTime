import assert from "node:assert/strict";
import { isAsianMediaItem } from "../src/lib/asian-media.ts";
import { classifyTvWorld, recordMatchesTvWorld } from "../src/lib/tv-world-classification.ts";

const hostages = {
  title: "Hostages",
  originalLanguage: "en",
  originCountries: ["US"],
  classificationComplete: true,
};

assert.equal(isAsianMediaItem(hostages), false, "TMDB 55083 Hostages is a US production, not Asian TV");
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

console.log("Asian TV classification regression tests passed.");
