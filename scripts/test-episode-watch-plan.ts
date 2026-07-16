import assert from "node:assert/strict";
import {
  buildEpisodeWatchPlan,
  buildSeasonWatchPlan,
  type WatchEpisodeRef,
} from "../src/lib/episode-watch-plan.ts";
import { canonicalMediaPoster } from "../src/lib/media-poster.ts";

const released: WatchEpisodeRef[] = [
  { seasonNumber: 1, episodeNumber: 1, episodeName: "Pilot" },
  { seasonNumber: 1, episodeNumber: 2 },
  { seasonNumber: 2, episodeNumber: 1 },
  { seasonNumber: 2, episodeNumber: 2 },
  { seasonNumber: 3, episodeNumber: 1 },
  { seasonNumber: 3, episodeNumber: 2 },
];

const episodePlan = buildEpisodeWatchPlan({
  target: { seasonNumber: 2, episodeNumber: 2, episodeName: "Target" },
  releasedEpisodes: released,
  watchedKeys: new Set(["1-1"]),
});
assert.deepEqual(
  episodePlan.previousUnwatched.map((episode) => `${episode.seasonNumber}-${episode.episodeNumber}`),
  ["1-2", "2-1"],
  "episode warnings must include gaps from previous seasons and earlier episodes in the same season",
);
assert.equal(episodePlan.selectedEpisodes.length, 1, "selected-only must change exactly the chosen episode");
assert.equal(episodePlan.allEpisodes.length, 3, "confirm-all must include previous gaps plus the selected episode");

const seasonPlan = buildSeasonWatchPlan({
  seasonNumber: 3,
  releasedEpisodes: released,
  watchedKeys: new Set(["1-1", "2-2"]),
});
assert.deepEqual(
  seasonPlan.selectedEpisodes.map((episode) => `${episode.seasonNumber}-${episode.episodeNumber}`),
  ["3-1", "3-2"],
  "selected-only season action must change only released episodes in that season",
);
assert.deepEqual(
  seasonPlan.previousUnwatched.map((episode) => `${episode.seasonNumber}-${episode.episodeNumber}`),
  ["1-2", "2-1"],
  "season warnings must include every earlier released gap",
);
assert.equal(seasonPlan.previousSeasonCount, 2);

assert.equal(
  canonicalMediaPoster("/one-punch-man-poster.jpg"),
  "https://image.tmdb.org/t/p/w500/one-punch-man-poster.jpg",
  "raw TMDB poster paths must become browser-safe absolute URLs",
);
assert.equal(
  canonicalMediaPoster("https://cdn.example.test/poster.jpg"),
  "https://cdn.example.test/poster.jpg",
  "absolute poster URLs must remain unchanged",
);
assert.equal(
  canonicalMediaPoster("/placeholder-poster.svg"),
  "/placeholder-poster.svg",
  "local placeholders must not be rewritten as TMDB assets",
);
assert.equal(canonicalMediaPoster(null), null);

console.log("Episode watch planning and poster normalization tests passed.");
