import assert from "node:assert/strict";
import { deriveTvTrackingState } from "../src/lib/tv-status-engine.ts";

const ongoingCompactCache = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: false,
  airedEpisodeCount: 10,
  airedEpisodeKeys: [],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4", "1-5"],
});
assert.equal(
  ongoingCompactCache.state,
  "watching",
  "an ongoing cache hit without aired keys must preserve real progress",
);
assert.equal(
  ongoingCompactCache.verified,
  false,
  "a numeric ongoing boundary cannot verify the exact watched-key intersection",
);
assert.equal(ongoingCompactCache.watchedAiredEpisodeCount, 5);

const ongoingExactCache = deriveTvTrackingState({
  persistedStatus: "not_started",
  officiallyEnded: false,
  airedEpisodeCount: 10,
  airedEpisodeKeys: Array.from({ length: 10 }, (_, index) => `1-${index + 1}`),
  watchedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4", "1-5"],
});
assert.equal(ongoingExactCache.state, "watching");
assert.equal(ongoingExactCache.verified, true);
assert.equal(ongoingExactCache.watchedAiredEpisodeCount, 5);

const caughtUpOngoing = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(caughtUpOngoing.state, "uptodate");
assert.equal(caughtUpOngoing.verified, true);

const endedNumericFallback = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: true,
  airedEpisodeCount: 3,
  airedEpisodeKeys: [],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(endedNumericFallback.state, "finished");
assert.equal(endedNumericFallback.verified, true);

console.log("TV cache regression tests passed.");
