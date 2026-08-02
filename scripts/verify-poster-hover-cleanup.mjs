#!/usr/bin/env node
import { readFileSync } from "node:fs";

const mediaCard = readFileSync("src/components/media/media-card.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
const safeImage = readFileSync("src/components/media/safe-image.tsx", "utf8");
const failures = [];

if (mediaCard.includes("tvtime-media-open-cue") || css.includes("tvtime-media-open-cue")) {
  failures.push("Media cards still expose the centered Play hover cue");
}
if (!/variant\s*===\s*"poster"\s*&&\s*"pointer-events-none"/.test(safeImage)) {
  failures.push("Poster images still allow the browser Visual Search hover overlay");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log("PASS: Play hover cues and poster Visual Search overlays are disabled globally");
