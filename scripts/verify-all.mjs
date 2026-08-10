#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const checks = [
  ["Repository hygiene", ["scripts/verify-repository-hygiene.mjs"]],
  ["Migration history", ["scripts/verify-migration-history.mjs"]],
  ["Patch 05 deployment guards", ["scripts/verify-patch-05.mjs"]],
  ["Patch 06 import validation tests", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-library-import-validation.ts"]],
  ["Patch 06 staged backup guards", ["scripts/verify-patch-06.mjs"]],
  ["Patch 07 TV cache regression tests", ["--experimental-strip-types", "scripts/test-tv-cache-regression.ts"]],
  ["Patch 07 atomic TV guards", ["scripts/verify-patch-07.mjs"]],
  ["Patch 08 behavior tests", ["--experimental-strip-types", "scripts/test-patch-08.ts"]],
  ["Patch 08 source guards", ["scripts/verify-patch-08.mjs"]],
  ["Patch 09 behavior tests", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-patch-09.ts"]],
  ["Patch 09 source guards", ["scripts/verify-patch-09.mjs"]],
  ["Patch 10 behavior tests", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-patch-10.ts"]],
  ["Patch 10 source guards", ["scripts/verify-patch-10.mjs"]],
  ["Patch 11 behavior tests", ["--experimental-strip-types", "scripts/test-patch-11.ts"]],
  ["Patch 11 source guards", ["scripts/verify-patch-11.mjs"]],
  ["Auth boundary tests", ["--experimental-strip-types", "scripts/test-auth-boundary.ts"]],
  ["Auth boundary source verification", ["scripts/verify-auth-boundary.mjs"]],
  ["Request identity and admin command tests", ["--experimental-strip-types", "scripts/test-request-authorization.ts"]],
  ["Request authorization source verification", ["scripts/verify-request-authorization.mjs"]],
  ["User-facing integrity", ["scripts/verify-user-facing-integrity.mjs"]],
  ["Home global statistics cards", ["scripts/verify-home-global-stats.mjs"]],
  ["Anime Hub", ["scripts/verify-anime-hub.mjs"]],
  ["Motion and loading performance", ["--experimental-strip-types", "scripts/test-performance-regressions.ts"]],
  ["Responsive layout and safe areas", ["--experimental-strip-types", "scripts/test-responsive-layout.ts"]],
  ["Horizontal shelf containment and dragging", ["scripts/verify-horizontal-shelves.mjs"]],
  ["Watch Next series cards", ["scripts/verify-watch-next-cards.mjs"]],
  ["Episode watch flow and posters", ["scripts/verify-episode-watch-poster.mjs"]],
  ["Arabic media worlds", ["scripts/verify-arabic-worlds.mjs"]],
  ["Arabic title localization", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-arabic-title-localization.ts"]],
  ["Arabic world consistency and Egyptian priority", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-arabic-world-consistency.ts"]],
  ["Asian TV classification", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-asian-classification.ts"]],
  ["Unified media-world pipeline", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-media-world-pipeline.ts"]],
  ["World separation", ["scripts/verify-world-separation.mjs"]],
  ["TVM-03/04/05", ["scripts/verify-tvm-03-04-05.mjs"]],
  ["TVM-06/07/08/09", ["scripts/verify-tvm-06-09.mjs"]],
  ["TVM-10/11/12/13", ["scripts/verify-tvm-10-13.mjs"]],
  ["Watch Undo and season alert behavior", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-watch-features.ts"]],
  ["Watch Undo and season alert guards", ["scripts/verify-watch-features.mjs"]],
  ["Global poster hover cleanup", ["scripts/verify-poster-hover-cleanup.mjs"]],
  ["Discover preset behavior", ["--experimental-strip-types", "scripts/test-discover-presets.ts"]],
  ["TV Discover behavior", ["--experimental-strip-types", "--loader", "./scripts/ts-path-loader.mjs", "scripts/test-discover-tv-behavior.ts"]],
];

const failures = [];
for (const [label, args] of checks) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    failures.push({
      label,
      status: result.status ?? 1,
      error: result.error?.message ?? null,
    });
  }
}

console.log("\n=== Maintained verification summary ===");
for (const [label] of checks) {
  const failure = failures.find((item) => item.label === label);
  console.log(`${failure ? "FAIL" : "PASS"}: ${label}${failure?.error ? ` (${failure.error})` : ""}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} maintained verification suite(s) failed.`);
  process.exit(1);
}
console.log("\nAll maintained Trakora verification suites passed.");
