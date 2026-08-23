#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const styles = read("src/app/globals.css");
const row = read("src/components/media/media-row.tsx");
const anime = read("src/components/views/anime-hub-overview.tsx");
const movieHub = read("src/components/views/movie-hub-view.tsx");
const discover = read("src/components/views/discover-view.tsx");
const collection = read("src/components/views/collection-world-view.tsx");
const drag = read("src/hooks/use-horizontal-drag-scroll.ts");
const carousel = read("src/hooks/use-hero-carousel.ts");
const home = read("src/components/views/home-view.tsx");
const tv = read("src/components/views/tv-hub-overview.tsx");
const slider = read("src/components/ui/slider.tsx");

const checks = [
  [!styles.includes("100dvw"), "Movie-world containers never size themselves from the viewport inside a padded parent"],
  [/\.tvtime-movie-hub__overview > \*[\s\S]*max-width: 100%;[\s\S]*min-width: 0;/.test(styles), "Every current and future overview shelf wrapper is allowed to shrink"],
  [/\.tvtime-media-row-scroller,[\s\S]*width: 100%;[\s\S]*max-width: 100%;[\s\S]*touch-action: pan-x pan-y;/.test(styles), "Shared media rows own a bounded native horizontal scroll area"],
  [/pointerType === "touch"/.test(drag) && /browserScrollLeftAfterDrag/.test(drag) && !/gesture\.current\.rtl/.test(drag), "Touch keeps native momentum while mouse and pen use browser-normalized LTR and RTL drag scrolling"],
  [/onDragStart[\s\S]*preventDefault/.test(drag) && /onClickCapture[\s\S]*suppressClick/.test(drag), "Poster dragging cannot steal a shelf gesture or open a title after a drag"],
  [/useHorizontalDragScroll/.test(row) && /horizontal list/.test(row) && /tabIndex=\{0\}/.test(row), "Every shared Movies, TV and Anime media row is draggable and keyboard reachable"],
  [/useHorizontalDragScroll/.test(anime) && /Upcoming Anime episodes horizontal list/.test(anime), "The custom Anime next-episode shelf follows the same interaction contract"],
  [/quickPicksDragHandlers/.test(movieHub) && /presetDragHandlers/.test(discover) && /statusDragHandlers/.test(collection), "Tonight, Discover and library filter rails use the same reliable drag behavior"],
  [/visibilitychange/.test(carousel) && /reducedMotion/.test(carousel) && /interacting/.test(carousel) && /SWIPE_BLOCKING_SELECTOR/.test(carousel) && !/setHovered/.test(carousel) && !/setFocused/.test(carousel), "Hero autoplay keeps running across hover, focus, and manual navigation while pausing for active touch gestures and accessibility"],
  [/animation: tvtime-hero-slide-progress var\(--tvtime-carousel-duration, 7s\)/.test(styles) && /animation-play-state: var\(--tvtime-carousel-play-state, running\)/.test(styles), "Hero progress uses the same duration and pause state as the autoplay timer at every breakpoint"],
  [/Carousel controls keep[\s\S]*?width: 44px;[\s\S]*?@media \(max-width: 767px\)/.test(styles), "Hero carousel controls have global 44px targets rather than a phone-only override"],
  [[home, anime, tv, movieHub].every((source) => /useHeroCarousel/.test(source)), "Every editorial hero uses the shared carousel interaction contract"],
  [/tvtime-recent-scroller[\s\S]*horizontal list[\s\S]*tabIndex=\{0\}/.test(home) && /useHorizontalDragScroll/.test(home), "Recently Watched is draggable, labelled, and keyboard reachable"],
  [/advanceInertia/.test(drag) && /shouldStartInertia/.test(drag) && /prefers-reduced-motion: reduce/.test(drag), "Mouse and pen inertia is bounded and disabled for reduced motion"],
  [/priorityCount = 0/.test(row) && /priority=\{i < priorityCount\}/.test(row) && !/new Image\(\)/.test(home), "Shelf images are lazy by default and Home does not preload original hero backdrops"],
  [/BoundedScrollPositionCache/.test(drag) && /useLayoutEffect/.test(drag) && /scrollKey/.test(drag), "Rail positions use bounded in-memory restoration before paint"],
  [/\.tvtime-recent-scroller,[\s\S]{0,120}touch-action: pan-x pan-y pinch-zoom;/.test(styles), "Recently Watched preserves native pan and pinch zoom gestures"],
  [/currentRouteKey[\s\S]*scrollKey: loading \? undefined : resolvedScrollKey[\s\S]*restoreDependency/.test(row) && /recently\.isLoading \? undefined : "home:recently-watched"/.test(home), "Media rows and Recently Watched restore stable route-aware positions only after real content mounts"],
  [/anime-hub:next-episodes/.test(anime) && /movie-hub:\$\{world\}:tonight-filters/.test(movieHub) && /discover:.*:presets/.test(discover) && /collectionRailKey/.test(collection), "Custom content and filter rails also retain their positions by stable page identity"],
  [/شرائح الأفلام المميزة/.test(movieHub) && /الفيلم المميز السابق/.test(movieHub) && /الفيلم المميز التالي/.test(movieHub), "Arabic Movie hero controls keep Arabic accessible names"],
  [/SliderPrimitive\.Thumb[\s\S]*aria-label=\{ariaLabel/.test(slider), "The actual slider thumb receives the caller's accessible label"],
];

let failed = 0;
for (const [condition, message] of checks) {
  console.log(`${condition ? "PASS" : "FAIL"}: ${message}`);
  if (!condition) failed += 1;
}
if (failed) process.exit(1);

const behavior = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/test-horizontal-gestures.ts"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
if (behavior.error || behavior.status !== 0) process.exit(behavior.status ?? 1);

console.log(`\nHorizontal shelf verification passed (${checks.length} structural checks + behavior tests).`);
