#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const checks = [
  ["Repository hygiene", ["scripts/verify-repository-hygiene.mjs"]],
  ["User-facing integrity", ["scripts/verify-user-facing-integrity.mjs"]],
  ["Episode watch flow and posters", ["scripts/verify-episode-watch-poster.mjs"]],
  ["Arabic media worlds", ["scripts/verify-arabic-worlds.mjs"]],
  ["World separation", ["scripts/verify-world-separation.mjs"]],
  ["TVM-03/04/05", ["scripts/verify-tvm-03-04-05.mjs"]],
  ["TVM-06/07/08/09", ["scripts/verify-tvm-06-09.mjs"]],
  ["TVM-10/11/12/13", ["scripts/verify-tvm-10-13.mjs"]],
];

for (const [label, args] of checks) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(`${label} could not start:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n${label} failed with exit code ${result.status ?? "unknown"}.`);
    process.exit(result.status || 1);
  }
}

console.log("\nAll maintained TvTime verification suites passed.");
