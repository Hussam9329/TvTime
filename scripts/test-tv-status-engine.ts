import assert from "node:assert/strict";
import {
  deriveTvTrackingState,
  episodeKey,
  inferAiredEpisodesFromTvDetail,
  isEpisodeReleased,
  isFutureEpisode,
  tvStateToMediaPatch,
} from "../src/lib/tv-status-engine.ts";

const now = new Date("2026-07-10T12:00:00.000Z");

assert.equal(isEpisodeReleased("2026-07-10", now), true, "same-day episode must count as released");
assert.equal(isFutureEpisode("2026-07-11", now), true, "future episode must stay future");

const inferred = inferAiredEpisodesFromTvDetail({
  status: "Returning Series",
  seasons: [
    { season_number: 1, episode_count: 10 },
    { season_number: 2, episode_count: 8 },
  ],
  last_episode_to_air: { season_number: 2, episode_number: 5, air_date: "2026-07-09" },
  next_episode_to_air: { season_number: 2, episode_number: 6, air_date: "2026-07-17" },
}, now);
assert.equal(inferred.airedEpisodeCount, 15, "only episodes through the last aired boundary count");
assert.equal(inferred.airedEpisodeKeys.has(episodeKey(2, 6)), false, "future boundary must not enter progress");

const caughtUpOngoing = deriveTvTrackingState({
  persistedStatus: "finished",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(caughtUpOngoing.state, "uptodate", "an ongoing show can never be Finished");

const newlyAired = deriveTvTrackingState({
  persistedStatus: "uptodate",
  officiallyEnded: false,
  airedEpisodeCount: 4,
  airedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(newlyAired.state, "watching", "a new aired episode must move Up To Date to Watching");

const ongoingWithUnknownEpisodeTotal = deriveTvTrackingState({
  persistedStatus: "finished",
  officiallyEnded: false,
  airedEpisodeCount: null,
  watchedEpisodeKeys: ["1-1"],
});
assert.equal(
  ongoingWithUnknownEpisodeTotal.state,
  "watching",
  "an explicitly ongoing show must not remain Finished when episode totals are temporarily unavailable",
);

const finished = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: true,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(finished.state, "finished", "only an officially ended fully watched show is Finished");

const futureIgnored = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: false,
  airedEpisodeCount: 2,
  airedEpisodeKeys: ["1-1", "1-2"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(futureIgnored.state, "uptodate");
assert.equal(futureIgnored.watchedAiredEpisodeCount, 2);
assert.equal(futureIgnored.futureOrUnknownWatchedEpisodeCount, 1);

assert.equal(deriveTvTrackingState({
  persistedStatus: "planned",
  officiallyEnded: false,
  airedEpisodeCount: 2,
  watchedEpisodeKeys: [],
  airedEpisodeKeys: ["1-1", "1-2"],
}).state, "planned");

assert.equal(deriveTvTrackingState({
  persistedStatus: "not_started",
  officiallyEnded: false,
  airedEpisodeCount: 2,
  watchedEpisodeKeys: [],
  airedEpisodeKeys: ["1-1", "1-2"],
}).state, "not_started");

const patch = tvStateToMediaPatch("watching", new Date("2026-07-01T00:00:00Z"));
assert.deepEqual(Object.keys(patch).sort(), ["status", "watched", "watchedAt"], "TV state patch must never contain rating fields");

console.log("TVM-03/04/05 engine tests passed (11 assertion groups).");
