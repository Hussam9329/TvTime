#!/usr/bin/env node
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
const safeImage = readFileSync("src/components/media/safe-image.tsx", "utf8");
const failures = [];

if (!/\.tvtime-home-view\s+\.tvtime-media-open-cue\s*\{\s*display:\s*none;\s*\}/m.test(css)) {
  failures.push("Home media cards still expose the centered Play hover cue");
}
if (!/variant\s*===\s*"poster"\s*&&\s*"pointer-events-none"/.test(safeImage)) {
  failures.push("Poster images still allow the browser Visual Search hover overlay");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log("PASS: Home Play hover cue and poster Visual Search overlay are disabled");
