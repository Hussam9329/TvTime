#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
  [/"customLists"/, "custom lists collection is missing"],
  [/"customListItems"/, "custom list items collection is missing"],
  [/"preferences"/, "preferences collection is missing"],
]);
requireText("src/app/api/library/clear/route.ts", [
  [/watchSession\.deleteMany/, "clear-all does not delete diary sessions"],
  [/notification\.deleteMany/, "clear-all does not delete notifications"],
  [/customList\.deleteMany/, "clear-all does not delete custom lists"],
  [/preferredPlatforms/, "clear-all does not declare preserved preferences"],
]);
requireText("src/lib/library-import-commit.ts", [
  [/collection = 'watchSessions'/, "diary restore merge is missing"],
  [/collection = 'notifications'/, "notification restore merge is missing"],
  [/collection: "customLists"/, "custom-list restore merge is missing"],
  [/collection: "preferences"/, "preference restore is missing"],
]);
requireText("prisma/schema.prisma", [
  [/timezone\s+String\s+@default\("Asia\/Baghdad"\)/, "user timezone field is missing"],
  [/country\s+String\s+@default\("IQ"\)/, "user country field is missing"],
  [/preferredPlatforms\s+String\[\]/, "preferred platforms field is missing"],
]);
requireText("prisma/migrations/20260718000000_data_lifecycle_preferences/migration.sql", [
  [/ADD COLUMN IF NOT EXISTS "timezone"/, "preference migration is missing"],
  [/Media_userRating_range_check/, "rating constraint is missing"],
  [/WatchSession_values_check/, "diary constraints are missing"],
]);
requireText("src/components/layout/header.tsx", [
  [/const myStuffNavItems/, "My Stuff navigation is missing"],
  [/view: "lists"/, "Lists navigation is missing"],
  [/TVTIME_SEARCH_FOCUS_EVENT/, "central search command is not wired"],
]);
requireText("src/components/layout/keyboard-shortcuts.tsx", [
  [/requestSearchFocus\(\)/, "keyboard search does not use the shared command"],
  [/setView\("lists"\)/, "lists keyboard navigation is missing"],
]);
if (/querySelector\([^\n]+Search movies/.test(read("src/components/layout/keyboard-shortcuts.tsx"))) {
  failures.push("keyboard-shortcuts.tsx: placeholder-based search lookup still exists");
}
requireText("src/app/arabic/movies/page.tsx", [[/canonical: "\/arabic\/movies"/, "movie canonical is missing"]]);
requireText("src/app/arabic/tv/page.tsx", [[/canonical: "\/arabic\/tv"/, "TV canonical is missing"]]);
if (/dir="rtl"/.test(read("src/app/arabic/layout.tsx"))) {
  failures.push("src/app/arabic/layout.tsx: RTL still wraps the entire AppShell");
}
requireText("src/components/media/watch-providers.tsx", [
  [/fetchUserPreferences/, "provider region is not account-synchronized"],
  [/preferredPlatforms/, "preferred platform highlighting is missing"],
]);

const pkg = JSON.parse(read("package.json"));
if (!String(pkg.scripts?.["verify:patch-09"] || "").includes("test-patch-09")) failures.push("package.json: Patch 09 tests are not wired");
if (!String(pkg.scripts?.["verify:patch-09"] || "").includes("verify-patch-09")) failures.push("package.json: Patch 09 source verifier is not wired");

if (failures.length) {
  console.error("[patch-09] verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("[patch-09] Full data lifecycle, synchronized preferences, navigation, RTL and search accessibility guards are present.");
