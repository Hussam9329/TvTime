import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  collectionWorldForCatalogue,
  filterAndPrioritizeMediaCollectionWorldItems,
  matchesMediaCollectionWorld,
  prioritizeMediaCollectionWorldItems,
} from "../src/lib/media-world-pipeline.ts";

type Fixture = {
  id: string;
  type?: string;
  media_type?: string;
  title?: string;
  name?: string;
  originalLanguage?: string;
  original_language?: string;
  originCountries?: string[];
  origin_country?: string[];
  genres?: Array<string | number>;
  genre_ids?: number[];
  isAnime?: boolean;
  classificationComplete?: boolean;
};

const standard: Fixture[] = [
  { id: "other", original_language: "fr", origin_country: ["FR"] },
  { id: "gb", originalLanguage: "en", originCountries: ["GB"] },
  { id: "english", original_language: "en", origin_country: ["FR"] },
  { id: "us", originalLanguage: "en", originCountries: ["US"] },
  { id: "ca", original_language: "en", origin_country: ["CA"] },
  { id: "mixed-us", original_language: "en", origin_country: ["SG", "US"] },
  { id: "arabic", original_language: "ar", origin_country: ["EG"] },
  { id: "asian", original_language: "ko", origin_country: ["KR"] },
  { id: "anime", original_language: "ja", origin_country: ["JP"], genre_ids: [16] },
];
assert.deepEqual(
  filterAndPrioritizeMediaCollectionWorldItems(standard, "movies").map((item) => item.id),
  ["us", "mixed-us", "ca", "gb", "english", "other"],
  "Standard catalogues must be exclusive and use US → CA → GB → English → other priority",
);

const asian: Fixture[] = [
  { id: "other-asian", original_language: "th", origin_country: ["TH"] },
  { id: "cn-language", original_language: "zh", origin_country: [] },
  { id: "jp", originalLanguage: "ja", originCountries: ["JP"], genres: ["Drama"] },
  { id: "kr-camel-fallback", originalLanguage: "ko", origin_country: [], originCountries: ["KR"] },
  { id: "jp-anime", original_language: "ja", origin_country: ["JP"], genre_ids: [16] },
  { id: "mixed", original_language: "en", origin_country: ["SG", "US"] },
];
assert.deepEqual(
  filterAndPrioritizeMediaCollectionWorldItems(asian, "asian-movies").map((item) => item.id),
  ["kr-camel-fallback", "jp", "cn-language", "other-asian"],
  "Asian catalogues must merge metadata shapes, exclude Anime/mixed productions, and use KR → JP → CN → other priority",
);

const arabic: Fixture[] = [
  { id: "gulf", original_language: "ar", origin_country: ["SA"] },
  { id: "iraq", originalLanguage: "ar", originCountries: ["IQ"] },
  { id: "egypt", original_language: "ar", origin_country: ["EG"] },
  { id: "syria", originalLanguage: "ar", originCountries: ["SY"] },
  { id: "foreign", original_language: "en", origin_country: ["EG"] },
];
assert.deepEqual(
  filterAndPrioritizeMediaCollectionWorldItems(arabic, "arabic-tv").map((item) => item.id),
  ["egypt", "syria", "iraq", "gulf"],
  "Arabic catalogues must stay Arabic-only and preserve Egypt-first priority",
);

const anime: Fixture[] = [
  { id: "anime-movie", media_type: "movie", original_language: "ja", origin_country: ["JP"], genre_ids: [16] },
  { id: "anime-tv", media_type: "tv", originalLanguage: "ja", originCountries: ["JP"], genres: ["Animation"] },
  { id: "live-action-title", media_type: "tv", title: "Death Note", original_language: "ja", origin_country: ["JP"], genre_ids: [18] },
];
assert.deepEqual(
  filterAndPrioritizeMediaCollectionWorldItems(anime, "anime").map((item) => item.id),
  ["anime-movie", "anime-tv"],
  "Anime must include movies and TV while explicit live-action metadata overrides the title fallback",
);

const stable = [
  { id: "first", original_language: "en", origin_country: ["US"] },
  { id: "second", original_language: "en", origin_country: ["US"] },
];
assert.deepEqual(
  prioritizeMediaCollectionWorldItems(stable, "movies").map((item) => item.id),
  ["first", "second"],
  "The caller's sort must remain stable inside a country-priority group",
);

assert.equal(collectionWorldForCatalogue("standard", "movie"), "movies");
assert.equal(collectionWorldForCatalogue("standard", "tv"), "standard-tv");
assert.equal(collectionWorldForCatalogue("arabic", "movie"), "arabic-movies");
assert.equal(collectionWorldForCatalogue("asian", "tv"), "asian-tv");
assert.equal(collectionWorldForCatalogue("anime", "movie"), "anime");
assert.equal(matchesMediaCollectionWorld(asian[4], "anime"), true);
assert.equal(matchesMediaCollectionWorld(asian[4], "asian-movies"), false);
assert.equal(
  matchesMediaCollectionWorld({ id: "standard-tv", media_type: "tv", original_language: "en", origin_country: ["US"] }, "movies"),
  false,
  "A standard TV search result must never enter the standard Movies world",
);
assert.equal(
  matchesMediaCollectionWorld({ id: "standard-movie", media_type: "movie", original_language: "en", origin_country: ["US"] }, "standard-tv"),
  false,
  "A standard movie search result must never enter the Standard TV world",
);
assert.equal(
  matchesMediaCollectionWorld({
    id: "stale-anime",
    isAnime: true,
    originalLanguage: "en",
    originCountries: ["US"],
    genres: ["Drama"],
  }, "movies"),
  true,
  "Complete legacy metadata must supersede a stale Anime flag",
);

const centrallyWiredSurfaces = [
  "src/components/views/discover-view.tsx",
  "src/components/views/movie-release-schedule.tsx",
  "src/components/views/search-view.tsx",
  "src/components/views/tv-hub-overview.tsx",
  "src/components/views/home-view.tsx",
  "src/components/media/genre-recommendations.tsx",
  "src/components/media/home-curated-sections.tsx",
  "src/components/views/movie-detail-view.tsx",
  "src/components/views/tv-detail-view.tsx",
  "src/app/api/media/route.ts",
  "src/app/api/movie-hub/route.ts",
  "src/app/api/anime/hub/route.ts",
  "src/app/api/discover/filtered/route.ts",
  "src/app/api/tmdb/[...path]/route.ts",
  "src/app/api/movies/calendar/route.ts",
  "src/app/api/tv/calendar/route.ts",
  "src/app/api/arabic-movies/calendar/route.ts",
  "src/app/api/library/following/route.ts",
  "src/app/api/tv-tracking/route.ts",
  "src/lib/asian-discover-server.ts",
];
for (const file of centrallyWiredSurfaces) {
  assert.match(
    readFileSync(file, "utf8"),
    /(?:filterAndPrioritize|prioritize|matches)MediaCollectionWorld/,
    `${file} must use the central media-world pipeline`,
  );
}
assert.match(
  readFileSync("src/components/views/collection-world-view.tsx", "utf8"),
  /collectionWorld: world/,
  "Every Movies/Asian/Arabic/Anime Library request must identify its exact collection world",
);

console.log("Media-world pipeline behavior and surface wiring: PASS");
