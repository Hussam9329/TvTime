#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const stages = [
  ["Strict ESLint", [process.execPath, "./node_modules/eslint/bin/eslint.js", ".", "--max-warnings=0"]],
  ["TypeScript", [process.execPath, "./node_modules/typescript/bin/tsc", "--noEmit"]],
  ["Maintained behavior and source guards", [process.execPath, "scripts/verify-all.mjs"]],
];

const failures = [];
for (const [label, command] of stages) {
  console.log(`\n=== ${label} ===`);
  const [program, ...args] = command;
  const result = spawnSync(program, args, { cwd: process.cwd(), stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) {
    failures.push({ label, status: result.status ?? 1, error: result.error?.message });
  }
}

console.log("\n=== CI gate summary ===");
for (const [label] of stages) {
  const failure = failures.find((item) => item.label === label);
  console.log(`${failure ? "FAIL" : "PASS"}: ${label}${failure?.error ? ` (${failure.error})` : ""}`);
}
if (failures.length > 0) process.exit(1);
console.log("\nAll static and maintained verification stages passed.");
