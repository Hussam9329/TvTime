import assert from "node:assert/strict";
import { buildSeenIdSet } from "../src/lib/discover-seen.ts";

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

console.log("Patch 08 behavior tests passed.");
