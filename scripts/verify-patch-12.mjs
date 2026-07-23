#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => readFileSync(resolve(root, file), "utf8");
const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

const css = read("src/app/globals.css");
const shell = read("src/components/app-shell.tsx");
const header = read("src/components/layout/header.tsx");
const dock = read("src/components/layout/mobile-dock.tsx");
const footer = read("src/components/layout/footer.tsx");
const mediaCard = read("src/components/media/media-card.tsx");
const mediaRow = read("src/components/media/media-row.tsx");
const home = read("src/components/views/home-view.tsx");
const navLayout = read("src/lib/navigation-layout.ts");
const button = read("src/components/ui/button.tsx");
const pkg = JSON.parse(read("package.json"));
const verifyAll = read("scripts/verify-all.mjs");
const patchPlan = read("PATCH_PLAN.md");
const patchNotes = read("PATCH_12.md");
const readme = read("README.md");

requireCheck(css.includes("Patch 12 — premium cinematic refinement"), "Patch 12 visual layer is missing");
requireCheck(css.includes("--app-content-width") && css.includes("--app-shadow-poster"), "premium layout/elevation tokens are missing");
requireCheck(/\.tvtime-header-inner[\s\S]*backdrop-filter/.test(css), "floating command header treatment is missing");
requireCheck(/\.tvtime-mobile-dock[\s\S]*env\(safe-area-inset-bottom(?:,\s*0px)?\)/.test(css), "mobile dock does not respect the safe area");
requireCheck(/\.tvtime-home-hero__title[\s\S]*font-size:\s*clamp/.test(css), "responsive cinematic hero typography is missing");
requireCheck(/\.tvtime-media-poster[\s\S]*--app-shadow-poster/.test(css), "poster-first card elevation is missing");
requireCheck(/@media \(prefers-reduced-motion: reduce\)/.test(css), "reduced-motion behavior regressed");
requireCheck(/\.tvtime-media-score,[\s\S]*inset-inline-start/.test(css) && /\.tvtime-media-menu[\s\S]*inset-inline-end/.test(css), "poster controls are not direction-safe");
const sharedSurfaceIndex = css.lastIndexOf("Shared surfaces are solid enough");
const finalPosterResetIndex = css.lastIndexOf("Keep poster cards intentionally unboxed");
requireCheck(sharedSurfaceIndex >= 0 && finalPosterResetIndex > sharedSurfaceIndex, "poster card reset must follow the shared surface layer");

requireCheck(/import \{ MobileDock \}/.test(shell) && /<MobileDock \/>/.test(shell), "AppShell does not render the mobile navigation dock");
requireCheck(/max-w-\[1440px\]/.test(shell) && /tvtime-view-transition/.test(shell), "main content rhythm/transition wrapper is missing");

requireCheck(/PRIMARY_NAV_VIEWS/.test(header) && /SECONDARY_NAV_VIEWS/.test(header), "header navigation does not use the shared hierarchy");
requireCheck(/<DropdownMenu[\s\S]*More destinations/.test(header), "secondary destinations are not grouped in the More menu");
requireCheck(/Search titles, people/.test(header) && /tvtime-command-search/.test(header), "command-style desktop search is missing");
requireCheck(/detailView && historyLength > 0/.test(header), "detail-route back affordance regressed");

requireCheck(/MOBILE_DOCK_VIEWS/.test(dock) && /aria-current=\{active \? "page"/.test(dock), "mobile dock hierarchy/current-page semantics are incomplete");
requireCheck(/if \(isDetailView\(view\)\) return null/.test(dock), "mobile dock must stay hidden on focused detail views");
requireCheck(/aria-label="Quick navigation"/.test(dock), "mobile dock lacks an accessible navigation label");

requireCheck(/<article className="tvtime-media-card group">/.test(mediaCard), "media cards are not represented as semantic articles");
requireCheck(/<a[\s\S]*className="tvtime-media-card-link"/.test(mediaCard), "media card primary destination is not a native link");
requireCheck(/<DropdownMenu>/.test(mediaCard) && /More actions for \$\{title\}/.test(mediaCard), "media card secondary actions are missing");
requireCheck(!/motion\.(a|article|div)/.test(mediaCard), "media cards still depend on staggered motion wrappers");
requireCheck(!/role="button"/.test(mediaCard), "media card uses a synthetic button role");
requireCheck(/text-start/.test(mediaCard), "media card fallback control is not RTL-safe");
requireCheck((mediaCard.match(/mediaType:/g) || []).length >= 1, "media state requests are missing media type");
requireCheck(!/mediaType:[^\n]*\n\s*mediaType:/.test(mediaCard), "media state request contains a duplicate mediaType property");

requireCheck(/useId/.test(mediaRow) && /aria-labelledby=\{headingId\}/.test(mediaRow), "media rows are not exposed as labelled sections");
requireCheck(/scrollBy\(\{[\s\S]*left:\s*direction === "left" \? -amount : amount,[\s\S]*behavior:\s*"smooth"/.test(mediaRow), "media row controls do not use smooth bounded scrolling");
requireCheck(/tvtime-section-heading__count/.test(mediaRow), "media rows do not expose collection size");

requireCheck((home.match(/<h1/g) || []).length === 1, "home must retain exactly one primary heading");
requireCheck(/tvtime-home-hero__poster/.test(home) && /tvtime-home-hero__meta/.test(home), "premium home hero composition is incomplete");
requireCheck(/tvtime-library-overview/.test(home) && /tvtime-stat-grid/.test(home), "library overview hierarchy is missing");
requireCheck(/useReducedMotion/.test(home) && /duration: reduceMotion \? 0 : 0\.45/.test(home), "home hero does not honor reduced-motion preference");
requireCheck(/function WatchNextCTA/.test(home) && /Continue watching/.test(home), "watch-next continuation affordance is missing");
requireCheck(/Loading recently watched titles/.test(home), "recent activity loading announcement regressed");

requireCheck(/<dl className="tvtime-footer-stats[^"]*"/.test(footer), "footer statistics are not semantic");
requireCheck(/data-variant=\{variant \?\? "default"\}/.test(button), "shared Button no longer exposes semantic variant metadata");

requireCheck(/PRIMARY_NAV_VIEWS/.test(navLayout) && /MOBILE_DOCK_VIEWS/.test(navLayout), "central navigation layout registry is missing");
requireCheck(/export function isDetailView/.test(navLayout) && /export function isMobileDockView/.test(navLayout), "navigation layout helpers are missing");

const patchCommand = String(pkg.scripts?.["verify:patch-12"] || "");
requireCheck(patchCommand.includes("test-patch-12") && patchCommand.includes("verify-patch-12"), "Patch 12 checks are not wired into package.json");
requireCheck(/Patch 12 navigation hierarchy tests/.test(verifyAll) && /Patch 12 visual source guards/.test(verifyAll), "Patch 12 is not included in verify:all");
requireCheck(/\| 12 \|/.test(patchPlan), "PATCH_PLAN.md does not track Patch 12");
requireCheck(/No database migration/.test(patchNotes) && /No API contract change/.test(patchNotes), "Patch 12 non-goals are not documented");
requireCheck(/Patch 12/.test(readme) && /npm run verify:patch-12/.test(readme), "README does not document the premium visual gate");
requireCheck(existsSync(resolve(root, "scripts/test-patch-12.ts")), "Patch 12 behavior test file is missing");

if (failures.length > 0) {
  console.error("[patch-12] verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[patch-12] Premium shell, navigation hierarchy, cinematic home, poster cards, responsive dock, RTL-safe controls and documentation are present.");
