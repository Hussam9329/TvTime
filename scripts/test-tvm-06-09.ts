import assert from "node:assert/strict";
import {
  deriveTvTrackingState,
  episodeKey,
  inferAiredEpisodesFromTvDetail,
  isOfficiallyEndedTvStatus,
  tvStateToMediaPatch,
} from "../src/lib/tv-status-engine.ts";
import { isWholeSeriesRatingEligible } from "../src/lib/tv-rating-rules.ts";
import {
  clampRatingOutOf100,
  episodeRatingKey,
  episodeRatingMediaType,
  parseEpisodeRatingMediaType,
} from "../src/lib/episode-rating.ts";

const now = new Date("2026-07-10T12:00:00.000Z");

// TVM-06: an ongoing show that was caught up must move to Watching as soon as
// one additional released episode exists and has not been watched.
const caughtUp = deriveTvTrackingState({
  persistedStatus: "uptodate",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(caughtUp.state, "uptodate");

const newEpisodeReleased = deriveTvTrackingState({
  persistedStatus: "uptodate",
  officiallyEnded: false,
  airedEpisodeCount: 4,
  airedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(newEpisodeReleased.state, "watching");
assert.equal(newEpisodeReleased.watchedAiredEpisodeCount, 3);

// Same-day TMDB next_episode_to_air is treated as released, while the next
// future episode never enters completion.
const sameDayBoundary = inferAiredEpisodesFromTvDetail({
  status: "Returning Series",
  seasons: [{ season_number: 1, episode_count: 10 }],
  last_episode_to_air: { season_number: 1, episode_number: 3, air_date: "2026-07-03" },
  next_episode_to_air: { season_number: 1, episode_number: 4, air_date: "2026-07-10" },
}, now);
assert.equal(sameDayBoundary.airedEpisodeCount, 4);
assert.equal(sameDayBoundary.airedEpisodeKeys.has(episodeKey(1, 4)), true);

const futureBoundary = inferAiredEpisodesFromTvDetail({
  status: "Returning Series",
  seasons: [{ season_number: 1, episode_count: 10 }],
  last_episode_to_air: { season_number: 1, episode_number: 4, air_date: "2026-07-10" },
  next_episode_to_air: { season_number: 1, episode_number: 5, air_date: "2026-07-17" },
}, now);
assert.equal(futureBoundary.airedEpisodeCount, 4);
assert.equal(futureBoundary.airedEpisodeKeys.has(episodeKey(1, 5)), false);

// TVM-07: Finished requires an official terminal TMDB status and every final
// episode watched. A stale watched/finished flag can never prove completion.
for (const status of ["Returning Series", "In Production", "Planned", "Pilot"]) {
  assert.equal(isOfficiallyEndedTvStatus(status), false, `${status} must not be terminal`);
}
for (const status of ["Ended", "Canceled", "Cancelled"]) {
  assert.equal(isOfficiallyEndedTvStatus(status), true, `${status} must be terminal`);
}

const ongoingStaleFinished = deriveTvTrackingState({
  persistedStatus: "finished",
  officiallyEnded: false,
  airedEpisodeCount: 3,
  airedEpisodeKeys: ["1-1", "1-2", "1-3"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
  legacyCompleted: true,
});
assert.equal(ongoingStaleFinished.state, "uptodate");

const endedIncomplete = deriveTvTrackingState({
  persistedStatus: "finished",
  officiallyEnded: true,
  airedEpisodeCount: 4,
  airedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3"],
});
assert.equal(endedIncomplete.state, "watching");

const endedComplete = deriveTvTrackingState({
  persistedStatus: "watching",
  officiallyEnded: true,
  airedEpisodeCount: 4,
  airedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4"],
  watchedEpisodeKeys: ["1-1", "1-2", "1-3", "1-4"],
});
assert.equal(endedComplete.state, "finished");
assert.equal(tvStateToMediaPatch("finished").watched, true);
assert.equal(tvStateToMediaPatch("uptodate").watched, false);


// TVM-08: the whole-series rating gate is independent from episode ratings and
// opens only for an officially ended, fully watched final episode set.
assert.equal(isWholeSeriesRatingEligible({ officiallyEnded: false, totalEpisodes: 30, watchedEpisodes: 30 }), false);
assert.equal(isWholeSeriesRatingEligible({ officiallyEnded: true, totalEpisodes: 30, watchedEpisodes: 29 }), false);
assert.equal(isWholeSeriesRatingEligible({ officiallyEnded: true, totalEpisodes: 30, watchedEpisodes: 30 }), true);
assert.equal(isWholeSeriesRatingEligible({ officiallyEnded: true, totalEpisodes: 0, watchedEpisodes: 0 }), false);

// TVM-09: each episode has an independent identity and 0-100 value. These
// helpers never reference or mutate the whole-series rating.
assert.equal(episodeRatingMediaType(2, 7), "episode:2:7");
assert.deepEqual(parseEpisodeRatingMediaType("episode:2:7"), { seasonNumber: 2, episodeNumber: 7 });
assert.equal(parseEpisodeRatingMediaType("tv"), null);
assert.equal(episodeRatingKey(2, 7), "2-7");
assert.equal(clampRatingOutOf100(101), 100);
assert.equal(clampRatingOutOf100(-1), 0);
assert.equal(clampRatingOutOf100(74.6), 75);

console.log("TVM-06/07/08/09 engine and episode-rating tests passed (28 assertion groups).");
