import assert from "node:assert/strict";
import { buildGenreDistribution, mediaHasGenre } from "../src/lib/genre-profile.ts";

const shows = [
  { title: "Alpha", status: "watching", genres: ["Drama", "Sci-Fi & Fantasy"] },
  { title: "Beta", status: "finished", genres: ["Drama"] },
  { title: "Gamma", status: "watching", genres: ["Comedy"] },
];

const sciFiWatching = shows.filter((show) => show.status === "watching" && mediaHasGenre(show.genres, "Sci-Fi & Fantasy"));
assert.deepEqual(sciFiWatching.map((show) => show.title), ["Alpha"], "Genre + status must compose instead of replacing one another");
assert.equal(mediaHasGenre(["Drama"], "drama"), true, "Genre matching should be case-insensitive");
assert.equal(mediaHasGenre([], "Drama"), false, "Empty genres must not match a selected genre");
assert.equal(mediaHasGenre([], ""), true, "No selected genre must not filter rows");

const profile = buildGenreDistribution([
  { genres: ["Drama", "Thriller"] },
  { genres: ["Drama", "Science Fiction"] },
  { genres: ["Thriller"] },
  { genres: [] },
]);
assert.equal(profile.totalGenreTags, 5);
assert.equal(profile.titlesWithGenres, 3);
assert.equal(profile.titlesConsidered, 4);
assert.equal(profile.coveragePercentage, 75);
assert.deepEqual(profile.items.slice(0, 3).map((item) => [item.genre, item.count, item.percentage]), [
  ["Drama", 2, 40],
  ["Thriller", 2, 40],
  ["Science Fiction", 1, 20],
]);
assert.equal(Math.round(profile.items.reduce((sum, item) => sum + item.percentage, 0)), 100, "Profile percentages should sum to 100 when genre data exists");

console.log("PASS: BAT-07 genre composition and BAT-12 distribution math");
