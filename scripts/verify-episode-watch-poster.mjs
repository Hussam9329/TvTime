#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

let checks = 0;
function pass(message) {
  checks += 1;
  console.log(`PASS: ${message}`);
}
function requireText(file, pattern, message) {
  const source = fs.readFileSync(file, "utf8");
  if (!pattern.test(source)) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  pass(message);
}

const surfaces = [
  "src/components/views/tv-detail-view.tsx",
  "src/components/views/tv-tracking-view.tsx",
  "src/components/media/continue-watching.tsx",
];
for (const file of surfaces) {
  requireText(file, /EpisodeWatchConfirmationDialog/, `${file} uses the shared previous-episode decision dialog`);
  requireText(file, /buildEpisodeWatchPlan/, `${file} checks earlier released episodes before marking an episode`);
}
requireText("src/components/views/tv-detail-view.tsx", /buildSeasonWatchPlan/, "TV detail checks earlier seasons before marking a season");
requireText("src/components/views/tv-tracking-view.tsx", /buildSeasonWatchPlan/, "TV Tracking checks earlier seasons before marking a season");
requireText("src/components/media/continue-watching.tsx", /buildSeasonWatchPlan/, "Continue Watching checks earlier seasons before marking a season");
requireText("src/components/media/episode-watch-confirmation-dialog.tsx", /const selectedLabel =/, "dialog offers a selected-only path");
requireText("src/components/media/episode-watch-confirmation-dialog.tsx", /Previous \+|Previous seasons \+/, "dialog offers an explicit include-previous path");
requireText("src/components/media/episode-watch-confirmation-dialog.tsx", />Cancel</, "dialog keeps a true cancel action separate from selected-only");
requireText("src/lib/media-normalize.ts", /canonicalMediaPoster\(item\.poster\)/, "legacy raw poster paths are normalized on read");
requireText("src/app/api/media/find-or-create/route.ts", /canonicalMediaPoster\(poster\)/, "new media rows canonicalize poster URLs on write");
requireText("src/app/api/library/following/route.ts", /canonicalMediaPoster\(body\.posterPath\)/, "following writes canonical poster URLs");
requireText("src/app/api/library/watchlist/route.ts", /canonicalMediaPoster\(body\.posterPath\)/, "watchlist writes canonical poster URLs");

const test = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/test-episode-watch-plan.ts"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
if (test.error || test.status !== 0) {
  console.error("FAIL: episode watch planning unit tests did not pass");
  process.exit(test.status || 1);
}
pass("episode watch planning and poster normalization unit tests pass");

console.log(`\nEpisode watch/poster verification passed (${checks} checks).`);
