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

// === TVM-14: Haven't Watched — must be watching (started + has unaired released eps) ===
const haventWatchedEligible = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: false,
  airedEpisodeCount: 5,
  airedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4", "1-5"],
  watchedEpisodeKeys: ["1-1", "1-2"],
});
assert.equal(haventWatchedEligible.state, "watching", "Haven't Watched: started show with unaired released eps must be watching");
assert.ok(haventWatchedEligible.watchedAiredEpisodeCount < (haventWatchedEligible.airedEpisodeCount ?? 0), "Haven't Watched: must have unwatched released eps");

// TVM-14: Up To Date must NOT enter Haven't Watched
const haventWatchedExcluded = deriveTvTrackingState({
  persistedStatus: "uptodate",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(haventWatchedExcluded.state, "uptodate", "Haven't Watched: uptodate show must NOT be watching");
assert.equal(haventWatchedExcluded.watchedAiredEpisodeCount, haventWatchedExcluded.airedEpisodeCount, "Haven't Watched: uptodate has no unwatched released eps");

// TVM-14: Finished must NOT enter Haven't Watched
const finishedExcluded = deriveTvTrackingState({
  persistedStatus: "finished",
  officiallyEnded: true,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(finishedExcluded.state, "finished", "Haven't Watched: finished show must NOT be watching");

// TVM-14: Not Started must NOT enter Haven't Watched
const notStartedExcluded = deriveTvTrackingState({
  persistedStatus: "not_started",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: [],
});
assert.equal(notStartedExcluded.state, "not_started", "Haven't Watched: not_started show must NOT be watching");

// === TVM-15: Haven't Started — tracked but 0 episodes watched ===
const haventStartedEligible = deriveTvTrackingState({
  persistedStatus: "not_started",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: [],
});
assert.equal(haventStartedEligible.state, "not_started", "Haven't Started: 0 watched episodes must be not_started");
assert.equal(haventStartedEligible.watchedAiredEpisodeCount, 0, "Haven't Started: 0 watched episodes");

// TVM-15: Show with 1 watched episode must NOT be Haven't Started
const haventStartedExcluded = deriveTvTrackingState({
  persistedStatus: "not_started",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1"],
});
assert.notEqual(haventStartedExcluded.state, "not_started", "Haven't Started: 1+ watched episode must exit not_started");
assert.equal(haventStartedExcluded.state, "watching", "Haven't Started: 1 watched episode → watching");

// === TVM-16/17: FROM-like ongoing show must never be Finished ===
const fromScenario = deriveTvTrackingState({
  persistedStatus: "finished", // legacy/stale
  officiallyEnded: false, // FROM is ongoing
  airedEpisodeCount: 40,
  airedEpisodeKeys: Array.from({ length: 40 }, (_, i) => `1-${i + 1}`),
  watchedEpisodeKeys: Array.from({ length: 40 }, (_, i) => `1-${i + 1}`),
});
assert.equal(fromScenario.state, "uptodate", "FROM scenario: ongoing show with all aired eps must be uptodate, never finished");

// TVM-17: Ended show fully watched → finished
const endedFullyWatched = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: true,
  airedEpisodeCount: 10,
  airedEpisodeKeys: Array.from({ length: 10 }, (_, i) => `1-${i + 1}`),
  watchedEpisodeKeys: Array.from({ length: 10 }, (_, i) => `1-${i + 1}`),
});
assert.equal(endedFullyWatched.state, "finished", "Ended + fully watched → finished");

// TVM-17: Ended show with missing episodes → watching (not finished)
const endedIncomplete = deriveTvTrackingState({
  persistedStatus: "finished",
  officiallyEnded: true,
  airedEpisodeCount: 10,
  airedEpisodeKeys: Array.from({ length: 10 }, (_, i) => `1-${i + 1}`),
  watchedEpisodeKeys: Array.from({ length: 8 }, (_, i) => `1-${i + 1}`),
});
assert.equal(endedIncomplete.state, "watching", "Ended + incomplete → watching, not finished");

// TVM-17: Canceled show fully watched → finished (same as Ended)
const canceledFullyWatched = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: true, // isOfficiallyEndedTvStatus("Canceled") = true
  airedEpisodeCount: 5,
  airedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4", "1-5"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4", "1-5"],
});
assert.equal(canceledFullyWatched.state, "finished", "Canceled + fully watched → finished");

console.log("TVM-03/04/05 engine tests passed (11 assertion groups + TVM-14/15/16/17 extensions).");
