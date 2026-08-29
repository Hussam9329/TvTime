import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath: string) => readFileSync(`${root}${relativePath}`, "utf8");

const css = read("src/app/globals.css");
const responsiveMarker = "/* TVTIME responsive hardening:";
const responsiveStart = css.indexOf(responsiveMarker);

assert.notEqual(responsiveStart, -1, "The final responsive hardening layer must exist");
const responsiveCss = css.slice(responsiveStart);

const layout = read("src/app/layout.tsx");
assert.match(layout, /viewportFit:\s*"cover"/, "Standalone mode must opt into safe-area viewport coverage");
assert.match(layout, /userScalable:\s*true/, "Pinch zoom must remain enabled");
assert.doesNotMatch(layout, /maximumScale:\s*1\b/, "The viewport must not cap pinch zoom");

const header = read("src/components/layout/header.tsx");
assert.match(
  header,
  /classList\.add\("tvtime-mobile-search-active"\)/,
  "Opening mobile search must lock the background document",
);
assert.match(header, /role="dialog"[\s\S]*?aria-modal="true"/, "Mobile search must be exposed as a modal surface");

const footer = read("src/components/layout/footer.tsx");
assert.match(footer, /tvtime-footer-row/);
assert.match(footer, /sm:flex-wrap/);
assert.doesNotMatch(footer, /max-w-\[1400px\]/, "Footer must use the shared content rail");
assert.match(
  responsiveCss,
  /\.tvtime-header-inner,\s*\.tvtime-main-content,\s*\.tvtime-footer-inner\s*{[^}]*max-width:\s*var\(--app-content-width\)/s,
  "Header, main and footer must share one ultrawide rail",
);
for (const selector of ["tvtime-app-header", "tvtime-main-content", "tvtime-footer-inner"]) {
  assert.match(
    responsiveCss,
    new RegExp(`\\.${selector}\\s*\\{[^}]*padding-left:\\s*max\\([^;]*safe-area-inset-left[^}]*padding-right:\\s*max\\([^;]*safe-area-inset-right`, "s"),
    `${selector} must replace its normal gutter with larger physical safe-area insets`,
  );
}

const releaseSchedule = read("src/components/views/movie-release-schedule.tsx");
assert.match(releaseSchedule, /tvtime-release-schedule__window-label--compact/);
assert.match(releaseSchedule, /aria-label={previousWindowLabel}/);
assert.match(releaseSchedule, /aria-label={currentWindowLabel}/);
assert.match(releaseSchedule, /aria-label={nextWindowLabel}/);
assert.match(responsiveCss, /@media \(max-width: 479px\)[\s\S]*?window-label--compact\s*{\s*display:\s*inline;/);

assert.match(
  responsiveCss,
  /body:has\(\.tvtime-app-header\[data-mobile-search-open="true"\]\)[\s\S]*?\.tvtime-movie-hub__tabs[\s\S]*?safe-area-inset-top/s,
  "Hub tabs must clear both expanded search and the top safe area",
);
assert.match(
  responsiveCss,
  /@media \(orientation: landscape\) and \(max-width: 932px\) and \(max-height: 500px\) and \(pointer: coarse\)/,
  "Short landscape phones need a height-aware override",
);
assert.match(responsiveCss, /\.tvtime-mobile-dock\s*{\s*display:\s*block\s*!important;/);
assert.match(
  responsiveCss,
  /\.tvtime-mobile-search-panel\s*{[^}]*height:\s*calc\(100dvh[^}]*overflow:\s*hidden[^}]*background:\s*var\(--background\)\s*!important;/s,
  "Mobile search must be an opaque viewport-bounded surface",
);
assert.match(
  responsiveCss,
  /\.tvtime-app-header\[data-mobile-search-open="true"\]\s*{[^}]*z-index:\s*80;/s,
  "Open mobile search must sit above the dock and page content",
);
assert.match(
  responsiveCss,
  /html\.tvtime-mobile-search-active[\s\S]*?overflow:\s*hidden;/,
  "The page behind mobile search must not scroll",
);
assert.match(
  responsiveCss,
  /\.tvtime-mobile-search-section\s*{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
  "Search suggestions must scroll inside the available mobile viewport",
);

const tvDetail = read("src/components/views/tv-detail-view.tsx");
assert.match(tvDetail, /tvtime-tv-detail-tabs[^"\n]*justify-start[^"\n]*overflow-x-auto/);
assert.match(
  responsiveCss,
  /\.tvtime-tv-detail-tabs\s*{[^}]*display:\s*flex\s*!important;[^}]*overflow-x:\s*auto\s*!important;/s,
  "Mobile TV detail tabs must scroll rather than compress labels",
);

const confirmation = read("src/components/media/episode-watch-confirmation-dialog.tsx");
assert.match(confirmation, /tvtime-episode-watch-dialog__footer sm:grid sm:grid-cols-2/);
assert.match(responsiveCss, /\.tvtime-episode-watch-dialog__choice\s*{[^}]*white-space:\s*normal;/s);

const notifications = read("src/components/views/notification-center.tsx");
assert.match(notifications, /tvtime-notification-list min-h-0 flex-1 overflow-y-auto/);
assert.match(
  responsiveCss,
  /\.tvtime-notification-center\s*{[^}]*safe-area-inset-top[^}]*safe-area-inset-right[^}]*safe-area-inset-bottom[^}]*safe-area-inset-left/s,
);

const sheet = read("src/components/ui/sheet.tsx");
const toast = read("src/components/ui/toast.tsx");
assert.match(sheet, /data-side={side}/);
assert.match(sheet, /tvtime-sheet-content/);
assert.match(toast, /tvtime-toast-viewport/);
assert.match(responsiveCss, /\.tvtime-toast-viewport\s*{[^}]*safe-area-inset-top/s);

assert.match(
  responsiveCss,
  /\.tvtime-movie-hub,\s*\.tvtime-watch-next-page\s*{\s*padding-bottom:\s*0\s*!important;/s,
  "Only the shell should reserve mobile dock clearance",
);

assert.match(responsiveCss, /touch-action:\s*pan-y pinch-zoom/);
assert.match(responsiveCss, /touch-action:\s*pan-x pan-y pinch-zoom/);
assert.match(responsiveCss, /\.tvtime-media-row-scroller/);
assert.doesNotMatch(responsiveCss, /\.tvtime-media-row__scroller/);
assert.match(responsiveCss, /\.tvtime-home-hero__carousel-arrow\s*{[^}]*display:\s*grid\s*!important;/s);
assert.match(
  responsiveCss,
  /\.tvtime-home-hero__carousel-dot,\s*\.tvtime-home-hero__carousel-dot\[data-active="true"\]\s*{[^}]*width:\s*44px\s*!important;[^}]*height:\s*44px\s*!important;/s,
  "Hero pagination must expose 44px hit targets",
);
assert.match(responsiveCss, /\.tvtime-home-hero__carousel-dot::before\s*{/);
assert.match(responsiveCss, /animation-duration:\s*var\(--tvtime-carousel-duration, 7s\)/);
assert.match(responsiveCss, /animation-play-state:\s*var\(--tvtime-carousel-play-state, running\)/);
assert.match(
  responsiveCss,
  /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?\[data-slot="slider-thumb"\]\s*{[^}]*width:\s*44px\s*!important;[^}]*height:\s*44px\s*!important;/,
  "Slider thumbs must expose a 44px coarse-pointer hit area",
);
assert.match(
  responsiveCss,
  /\[data-slot="slider-thumb"\]::after\s*{[^}]*var\(--tvtime-slider-thumb-visual-size, 1rem\)/s,
  "The slider hit area must preserve a compact visual thumb",
);
const ratingDialog = read("src/components/media/rating-dialog.tsx");
assert.match(ratingDialog, /--tvtime-slider-thumb-visual-size:1\.25rem/);
assert.match(responsiveCss, /@media \(prefers-reduced-transparency: reduce\)/);

console.log("Responsive layout regression checks passed.");
