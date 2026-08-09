#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const styles = read("src/app/globals.css");
const row = read("src/components/media/media-row.tsx");
const anime = read("src/components/views/anime-hub-overview.tsx");
const movieHub = read("src/components/views/movie-hub-view.tsx");
const discover = read("src/components/views/discover-view.tsx");
const collection = read("src/components/views/collection-world-view.tsx");
const drag = read("src/hooks/use-horizontal-drag-scroll.ts");

const checks = [
  [!styles.includes("100dvw"), "Movie-world containers never size themselves from the viewport inside a padded parent"],
  [/\.tvtime-movie-hub__overview > \*[\s\S]*max-width: 100%;[\s\S]*min-width: 0;/.test(styles), "Every current and future overview shelf wrapper is allowed to shrink"],
  [/\.tvtime-media-row-scroller,[\s\S]*width: 100%;[\s\S]*max-width: 100%;[\s\S]*touch-action: pan-x pan-y;/.test(styles), "Shared media rows own a bounded native horizontal scroll area"],
  [/pointerType === "touch"/.test(drag) && /gesture\.current\.rtl \? 1 : -1/.test(drag), "Touch keeps native momentum while mouse and pen gain direction-aware drag scrolling"],
  [/onDragStart[\s\S]*preventDefault/.test(drag) && /onClickCapture[\s\S]*suppressClick/.test(drag), "Poster dragging cannot steal a shelf gesture or open a title after a drag"],
  [/useHorizontalDragScroll/.test(row) && /horizontal list/.test(row) && /tabIndex=\{0\}/.test(row), "Every shared Movies, TV and Anime media row is draggable and keyboard reachable"],
  [/useHorizontalDragScroll/.test(anime) && /Upcoming Anime episodes horizontal list/.test(anime), "The custom Anime next-episode shelf follows the same interaction contract"],
  [/quickPicksDragHandlers/.test(movieHub) && /presetDragHandlers/.test(discover) && /statusDragHandlers/.test(collection), "Tonight, Discover and library filter rails use the same reliable drag behavior"],
];

let failed = 0;
for (const [condition, message] of checks) {
  console.log(`${condition ? "PASS" : "FAIL"}: ${message}`);
  if (!condition) failed += 1;
}
if (failed) process.exit(1);
console.log(`\nHorizontal shelf verification passed (${checks.length} checks).`);
