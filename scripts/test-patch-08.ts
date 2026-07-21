import assert from "node:assert/strict";
import { createCustomListSchema, customListItemSchema, normalizeListSearchResults } from "../src/lib/custom-list-contract.ts";
import { buildSeenIdSet } from "../src/lib/discover-seen.ts";

const normalized = normalizeListSearchResults([
  { id: 10, title: "Movie A", media_type: "movie", poster_path: "/a.jpg", release_date: "2026-01-02" },
  { id: 20, name: "Show B", media_type: "tv", poster_path: null, first_air_date: "2025-03-04" },
  { id: 30, name: "Person", media_type: "person", poster_path: null },
  { id: 10, title: "Duplicate", media_type: "movie", poster_path: null },
] as any);
assert.deepEqual(normalized, [
  { tmdbId: 10, mediaType: "movie", title: "Movie A", posterPath: "/a.jpg", year: "2026" },
  { tmdbId: 20, mediaType: "tv", title: "Show B", posterPath: null, year: "2025" },
]);

const tvSeen = buildSeenIdSet("tv", [
  { tmdbId: 1, watched: false, status: "watching" },
  { tmdbId: 2, watched: false, status: "not_started" },
  { tmdbId: 3, watched: true, status: null },
], [4]);
assert.deepEqual([...tvSeen].sort((a, b) => a - b), [1, 3, 4]);

const movieSeen = buildSeenIdSet("movie", [
  { tmdbId: 7, watched: true },
  { tmdbId: 8, watched: false },
], [9]);
assert.deepEqual([...movieSeen].sort((a, b) => a - b), [7, 9]);

assert.equal(createCustomListSchema.safeParse({ name: "  Weekend  ", color: "#abcdef" }).success, true);
assert.equal(createCustomListSchema.safeParse({ name: "", color: "red" }).success, false);
assert.equal(customListItemSchema.safeParse({ tmdbId: 12, mediaType: "tv", title: "Show" }).success, true);
assert.equal(customListItemSchema.safeParse({ tmdbId: -1, mediaType: "person", title: "No" }).success, false);

console.log("Patch 08 behavior tests passed.");
