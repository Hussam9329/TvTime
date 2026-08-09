#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arabicMediaCountryPriority } from "../src/lib/arabic-media.ts";

const ordered = [
  { id: "other", origin_country: ["TN"] },
  { id: "gulf", origin_country: ["SA"] },
  { id: "iraq", origin_country: ["IQ"] },
  { id: "lebanon", origin_country: ["LB"] },
  { id: "syria", origin_country: ["SY"] },
  { id: "egypt", origin_country: ["EG"] },
].sort((left, right) => arabicMediaCountryPriority(left) - arabicMediaCountryPriority(right));

assert.deepEqual(
  ordered.map((item) => item.id),
  ["egypt", "syria", "lebanon", "iraq", "gulf", "other"],
  "Arabic movie country priority must keep Egypt first",
);
assert.equal(
  arabicMediaCountryPriority({ originCountries: ["EG"] }),
  0,
  "Persisted library records must use the same Egyptian priority as TMDB items",
);

const read = (path: string) => readFileSync(path, "utf8");
const hub = read("src/app/api/movie-hub/route.ts");
const media = read("src/app/api/media/route.ts");
const calendar = read("src/app/api/movies/calendar/route.ts");
const releases = read("src/components/views/movie-release-schedule.tsx");
const discover = read("src/lib/arabic-discover.ts");

assert.match(hub, /world === "arabic-movies"[\s\S]{0,160}discoverArabicShelfByCountryPriority\("movie"/, "Overview shelves must use efficient Egypt-first Arabic discovery");
assert.ok((hub.match(/arabicMediaCountryPriority/g) || []).length >= 3, "Personal Overview shelves must put Egyptian library titles first");
assert.match(media, /prioritizedItems[\s\S]{0,360}arabicMediaCountryPriority[\s\S]{0,180}slice\(offset, offset \+ limit\)/, "Library must prioritize Egypt before pagination");
assert.match(calendar, /discoverArabicCatalogueByCountryPriority\("movie"/, "Arabic release retrieval must reserve its first slots for Egyptian films");
assert.match(releases, /collectionWorld === "arabic-movies"[\s\S]{0,180}arabicMediaCountryPriority/, "Release cards must keep Egypt first inside the schedule");
assert.match(discover, /ARABIC_COUNTRY_PRIORITY = \[\s*"EG"/, "Egypt must remain the first Arabic catalogue group");
assert.match(discover, /discoverArabicShelfByCountryPriority[\s\S]{0,1200}if \(results\.length >= limit\) break/, "Bounded Arabic shelves must stop querying once Egyptian results fill the shelf");

console.log("PASS: Egyptian movies have highest priority across every Arabic Movies section");
