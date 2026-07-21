import assert from "node:assert/strict";
import { APP_NAME, BACKUP_FILE_PREFIX } from "@/lib/brand";
import {
  DISCOVER_FETCH_BATCH_SIZE,
  DISCOVER_TMDB_PAGE_BUDGET,
  discoverCursorAfter,
  nextDiscoverPageBatch,
  parseDiscoverCursor,
} from "@/lib/discover-budget";
import {
  buildFastTvTrackingSummary,
  deriveFastTvTrackingState,
  type FastTvTrackingRow,
} from "@/lib/tv-tracking-counts";
import { isSupportedBackupApp } from "@/lib/library-transfer-types";

const now = new Date("2026-07-21T12:00:00.000Z");
const baseRow: FastTvTrackingRow = {
  tmdbId: 1,
  status: null,
  watched: false,
  episodeCount: 0,
  lastWatchedAt: null,
  officiallyEnded: null,
  airedEpisodeCount: null,
  nextEpisodeAirDate: null,
  metadataFresh: false,
};

assert.deepEqual(
  deriveFastTvTrackingState({ ...baseRow, status: "planned" }),
  { state: "planned", hasUnwatchedReleasedEpisode: false, verified: true },
  "planned state is preserved without loading TMDB",
);
assert.deepEqual(
  deriveFastTvTrackingState(baseRow),
  { state: "not_started", hasUnwatchedReleasedEpisode: false, verified: true },
  "an untouched show remains not started",
);
assert.deepEqual(
  deriveFastTvTrackingState({ ...baseRow, episodeCount: 3, airedEpisodeCount: 10, metadataFresh: true }),
  { state: "watching", hasUnwatchedReleasedEpisode: true, verified: true },
  "partial released progress is watching",
);
assert.deepEqual(
  deriveFastTvTrackingState({ ...baseRow, episodeCount: 10, airedEpisodeCount: 10, metadataFresh: true, officiallyEnded: false }),
  { state: "uptodate", hasUnwatchedReleasedEpisode: false, verified: true },
  "an ongoing show caught up to released episodes is up to date",
);
assert.deepEqual(
  deriveFastTvTrackingState({ ...baseRow, episodeCount: 12, airedEpisodeCount: 12, metadataFresh: true, officiallyEnded: true }),
  { state: "finished", hasUnwatchedReleasedEpisode: false, verified: true },
  "an ended show with all released episodes is finished",
);
assert.deepEqual(
  deriveFastTvTrackingState({ ...baseRow, status: "not_started", episodeCount: 2 }),
  { state: "watching", hasUnwatchedReleasedEpisode: true, verified: false },
  "stale metadata never erases real episode progress",
);

const summary = buildFastTvTrackingSummary([
  { ...baseRow, tmdbId: 1, status: "planned" },
  { ...baseRow, tmdbId: 2 },
  {
    ...baseRow,
    tmdbId: 3,
    episodeCount: 3,
    airedEpisodeCount: 10,
    metadataFresh: true,
    nextEpisodeAirDate: "2026-07-30",
  },
  {
    ...baseRow,
    tmdbId: 4,
    episodeCount: 10,
    airedEpisodeCount: 10,
    metadataFresh: true,
    officiallyEnded: false,
    nextEpisodeAirDate: "2026-08-05",
  },
  {
    ...baseRow,
    tmdbId: 5,
    episodeCount: 12,
    airedEpisodeCount: 12,
    metadataFresh: true,
    officiallyEnded: true,
  },
  { ...baseRow, tmdbId: 6, status: "not_started", episodeCount: 2 },
], now);
assert.deepEqual(summary.counts, {
  all: 6,
  planned: 1,
  watchlist: 1,
  notStarted: 1,
  haventStarted: 1,
  watching: 2,
  uptodate: 1,
  finished: 1,
  upcoming: 2,
  haventWatched: 2,
});
assert.equal(summary.freshMetadataRows, 3);
assert.equal(summary.unverifiedProgressRows, 1);

assert.deepEqual(parseDiscoverCursor(null), { page: 1, index: 0 });
assert.deepEqual(parseDiscoverCursor("9999:9999"), { page: 500, index: 20 });
assert.equal(discoverCursorAfter(4, 7, 20), "4:8");
assert.equal(discoverCursorAfter(4, 19, 20), "5:0");

let nextPage = 1;
let fetched = 0;
const requestedPages: number[] = [];
while (true) {
  const batch = nextDiscoverPageBatch({ nextPage, totalPages: 500, pagesFetched: fetched });
  if (batch.length === 0) break;
  assert.ok(batch.length <= DISCOVER_FETCH_BATCH_SIZE, "one batch stays inside the concurrency ceiling");
  requestedPages.push(...batch);
  fetched += batch.length;
  nextPage = batch.at(-1)! + 1;
}
assert.equal(fetched, DISCOVER_TMDB_PAGE_BUDGET);
assert.deepEqual(requestedPages, [1, 2, 3, 4, 5, 6, 7, 8]);
assert.deepEqual(
  nextDiscoverPageBatch({ nextPage: 4, totalPages: 5, pagesFetched: 0 }),
  [4, 5],
  "the page batch never crosses TMDB total_pages",
);

assert.equal(APP_NAME, "TvTime");
assert.equal(BACKUP_FILE_PREFIX, "tvtime-backup");
assert.equal(isSupportedBackupApp("TvTime"), true);
assert.equal(isSupportedBackupApp("CineTrack"), true, "old backup identity remains import-compatible");
assert.equal(isSupportedBackupApp("UnknownTracker"), false);

console.log("Patch 10 behavior tests passed: fast TV counts, Discover request budget and canonical branding.");
