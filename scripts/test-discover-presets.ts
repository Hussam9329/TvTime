#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { updateDiscoverRange } from "../src/lib/discover-filter-state.ts";
import { applyDiscoverPreset } from "../src/lib/discover-presets.ts";

const selected = {
  sortBy: "name.asc",
  fromYear: "1980",
  toYear: "1990",
  minVotes: "500",
};

assert.deepEqual(
  applyDiscoverPreset(selected, "classic", { isTv: true, isArabic: false, currentYear: 2026 }),
  { ...selected, sortBy: "popularity.desc" },
  "Classics must preserve a user-selected year range and vote threshold",
);

assert.deepEqual(
  applyDiscoverPreset(selected, "top2024", { isTv: true, isArabic: false, currentYear: 2026 }),
  { ...selected, sortBy: "vote_average.desc" },
  "Top-year must not replace a user-selected year range",
);

assert.deepEqual(
  applyDiscoverPreset(
    { sortBy: "popularity.desc", fromYear: "", toYear: "", minVotes: "" },
    "top2024",
    { isTv: true, isArabic: false, currentYear: 2026 },
  ),
  { sortBy: "vote_average.desc", fromYear: "2026", toYear: "2026", minVotes: "" },
  "Top-year should use the current year only when no year filter exists",
);

assert.deepEqual(
  applyDiscoverPreset(
    { sortBy: "name.asc", fromYear: "", toYear: "", minVotes: "" },
    "classic",
    { isTv: true, isArabic: false, currentYear: 2026 },
  ),
  { sortBy: "popularity.desc", fromYear: "", toYear: "1996", minVotes: "" },
  "Classics should target titles at least 30 years old when no year filter exists",
);

assert.equal(
  applyDiscoverPreset(selected, "newest", { isTv: true, isArabic: false, currentYear: 2026 }).sortBy,
  "first_air_date.desc",
  "TV Newest must use the TV first-air-date sort",
);

assert.equal(
  applyDiscoverPreset(selected, "hidden", { isTv: true, isArabic: false, currentYear: 2026 }).minVotes,
  "500",
  "Hidden gems must preserve a user-selected vote threshold",
);

assert.deepEqual(
  updateDiscoverRange({ min: "2020", max: "2024" }, "min", "2025"),
  { min: "2025", max: "2025" },
  "Moving the lower year past the upper year must keep a valid range",
);

assert.deepEqual(
  updateDiscoverRange({ min: "7", max: "9" }, "max", "6"),
  { min: "6", max: "6" },
  "Moving the upper score below the lower score must keep a valid range",
);

const discoverView = readFileSync("src/components/views/discover-view.tsx", "utf8");
const applyPresetSource = discoverView.slice(
  discoverView.indexOf("const applyPreset ="),
  discoverView.indexOf("const activeFilters ="),
);
for (const forbiddenReset of [
  "setSelectedGenres([])",
  'setUserScoreMin("")',
  'setUserScoreMax("")',
  'setRuntimeMin("")',
  'setRuntimeMax("")',
  'setCertification("")',
  'setKeywords("")',
  'setShowMe("all")',
]) {
  assert.equal(
    applyPresetSource.includes(forbiddenReset),
    false,
    `Quick picks must not clear an existing filter via ${forbiddenReset}`,
  );
}

console.log("PASS: Discover quick picks preserve active filters and apply correct defaults");
