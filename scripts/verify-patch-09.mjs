#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
function requireText(path, checks) {
  const source = read(path);
  for (const [pattern, message] of checks) if (!pattern.test(source)) failures.push(`${path}: ${message}`);
}

requireText("src/lib/library-transfer-types.ts", [
  [/LIBRARY_BACKUP_VERSION\s*=\s*6/, "backup version 6 is missing"],
  [/"watchSessions"/, "diary collection is missing"],
  [/"notifications"/, "notifications collection is missing"],
  [/"preferences"/, "preferences collection is missing"],
]);
requireText("src/app/api/library/clear/route.ts", [
  [/watchSession\.deleteMany/, "clear-all does not delete diary sessions"],
  [/notification\.deleteMany/, "clear-all does not delete notifications"],
  [/"timezone"/, "clear-all does not declare the preserved timezone preference"],
]);
requireText("src/lib/library-import-commit.ts", [
  [/collection = 'watchSessions'/, "diary restore merge is missing"],
  [/collection = 'notifications'/, "notification restore merge is missing"],
  [/collection: "preferences"/, "preference restore is missing"],
]);
requireText("prisma/schema.prisma", [
  [/timezone\s+String\s+@default\("Asia\/Baghdad"\)/, "user timezone field is missing"],
]);
requireText("prisma/migrations/20260718000000_data_lifecycle_preferences/migration.sql", [
  [/ADD COLUMN IF NOT EXISTS "timezone"/, "preference migration is missing"],
  [/Media_userRating_range_check/, "rating constraint is missing"],
  [/WatchSession_values_check/, "diary constraints are missing"],
]);
requireText("src/components/layout/header.tsx", [
  [/TVTIME_SEARCH_FOCUS_EVENT/, "central search command is not wired"],
]);
requireText("src/components/layout/keyboard-shortcuts.tsx", [
  [/requestSearchFocus\(\)/, "keyboard search does not use the shared command"],
]);
if (/querySelector\([^\n]+Search movies/.test(read("src/components/layout/keyboard-shortcuts.tsx"))) {
  failures.push("keyboard-shortcuts.tsx: placeholder-based search lookup still exists");
}
requireText("src/app/arabic/movies/page.tsx", [[/canonical: "\/arabic\/movies"/, "movie canonical is missing"]]);
requireText("src/app/arabic/tv/page.tsx", [[/canonical: "\/arabic\/tv"/, "TV canonical is missing"]]);
if (/dir="rtl"/.test(read("src/app/arabic/layout.tsx"))) {
  failures.push("src/app/arabic/layout.tsx: RTL still wraps the entire AppShell");
}

const retiredProviderComponent = "src/components/media/watch-providers.tsx";
if (existsSync(resolve(root, retiredProviderComponent))) {
  failures.push(`${retiredProviderComponent}: retired Where to Watch component still exists`);
}
for (const path of [
  "src/lib/tmdb.ts",
  "src/components/views/movie-detail-view.tsx",
  "src/components/views/tv-detail-view.tsx",
]) {
  if (/WatchProviders|watch\/providers|Where to Watch|JustWatch/i.test(read(path))) {
    failures.push(`${path}: retired Where to Watch integration is still present`);
  }
}
for (const path of [
  "src/components/views/movie-detail-view.tsx",
  "src/components/views/tv-detail-view.tsx",
]) {
  requireText(path, [
    [/filmween\.net/, "Watch button lost its Filmween destination"],
    [/movie\.vodu\.me/, "Watch button lost its Vodu destination"],
    [/cinemana/, "Watch button lost its Cinemana destinations"],
    [/kirmzi\.sbs\/search\.php\?keywords=\$\{encodeURIComponent\(displayTitle\)\}&video-id=/, "Watch button lost its Kirmzi title search destination"],
  ]);
}

const pkg = JSON.parse(read("package.json"));
if (!String(pkg.scripts?.["verify:patch-09"] || "").includes("test-patch-09")) failures.push("package.json: Patch 09 tests are not wired");
if (!String(pkg.scripts?.["verify:patch-09"] || "").includes("verify-patch-09")) failures.push("package.json: Patch 09 source verifier is not wired");

if (failures.length) {
  console.error("[patch-09] verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("[patch-09] Full data lifecycle, synchronized timezone preference, navigation, RTL and search accessibility guards are present.");
