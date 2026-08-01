import assert from "node:assert/strict";
import { decodeJwt } from "jose";
import {
  formatAirDate,
  isSeasonFinale,
  isSeasonPremiere,
  isUpcomingSeasonAlert,
  notificationAlertDates,
  scheduledAirDate,
} from "../src/lib/notification-schedule.ts";
import { issueWatchUndoToken, verifyWatchUndoToken } from "../src/lib/watch-undo-token.ts";

process.env.VERCEL_ENV = "preview";
process.env.ALLOW_PUBLIC_MODE = "true";
delete process.env.APP_PASSWORD;
delete process.env.SESSION_SECRET;

const moviePayload = {
  kind: "movie" as const,
  userId: "watch-feature-test",
  mediaId: "movie-1",
  mediaBefore: {
    watched: false,
    watchedAt: null,
    status: "planned",
    userRating: 82,
    rewatch: false,
    rewatchCount: 0,
    tags: ["favorite"],
  },
};
const movieToken = await issueWatchUndoToken(moviePayload);
assert.deepEqual(await verifyWatchUndoToken(movieToken), moviePayload, "movie undo snapshot round-trips");
const decoded = decodeJwt(movieToken);
assert.equal(Number(decoded.exp) - Number(decoded.iat), 8, "undo token has only a short transport grace");

const episodePayload = {
  kind: "episodes" as const,
  userId: "watch-feature-test",
  showId: 42,
  mediaId: "series-1",
  mediaBefore: null,
  episodesBefore: [{ seasonNumber: 2, episodeNumber: 3, row: null }],
  rewatchCreatedAt: null,
};
const episodeToken = await issueWatchUndoToken(episodePayload);
assert.deepEqual(await verifyWatchUndoToken(episodeToken), episodePayload, "episode undo snapshot round-trips");

const now = new Date("2026-08-01T21:30:00.000Z"); // 00:30 on Aug 2 in Baghdad
assert.deepEqual(
  [...notificationAlertDates(now, "Asia/Baghdad")],
  ["2026-08-02", "2026-08-03"],
  "season alerts cover today and tomorrow in the user's timezone",
);
const premiere = { airDate: "2026-08-02", seasonNumber: 3, episodeNumber: 1 };
assert.equal(isUpcomingSeasonAlert(premiere, now, "Asia/Baghdad"), true);
assert.equal(isSeasonPremiere(premiere), true);
assert.equal(isUpcomingSeasonAlert({ ...premiere, airDate: "2026-08-04" }, now, "Asia/Baghdad"), false);

const seasonEpisodes = Array.from({ length: 8 }, (_, index) => ({
  season_number: 3,
  episode_number: index + 1,
}));
assert.equal(
  isSeasonFinale({ airDate: "2026-08-03", seasonNumber: 3, episodeNumber: 8 }, seasonEpisodes),
  true,
  "last regular episode is detected as the finale",
);
assert.equal(
  isSeasonFinale({ airDate: "2026-08-03", seasonNumber: 3, episodeNumber: 7 }, seasonEpisodes),
  false,
  "a non-final episode is not labeled as a finale",
);
assert.equal(scheduledAirDate("2026-08-02").toISOString(), "2026-08-02T12:00:00.000Z");
assert.ok(formatAirDate("2026-08-02", "Invalid/Timezone").length > 0, "invalid timezone falls back safely");

console.log("PASS: watch undo tokens and season notification scheduling");
