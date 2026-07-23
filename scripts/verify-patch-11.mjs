#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => readFileSync(resolve(root, file), "utf8");
const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

const css = read("src/app/globals.css");
const layout = read("src/app/layout.tsx");
const shell = read("src/components/app-shell.tsx");
const header = read("src/components/layout/header.tsx");
const footer = read("src/components/layout/footer.tsx");
const button = read("src/components/ui/button.tsx");
const input = read("src/components/ui/input.tsx");
const skeleton = read("src/components/ui/skeleton.tsx");
const emptyState = read("src/components/ui/empty-state.tsx");
const errorBoundary = read("src/components/error-boundary.tsx");
const globalError = read("src/app/global-error.tsx");
const home = read("src/components/views/home-view.tsx");
const viewMetadata = read("src/lib/view-metadata.ts");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const pkg = JSON.parse(read("package.json"));
const verifyAll = read("scripts/verify-all.mjs");
const patchPlan = read("PATCH_PLAN.md");
const patchNotes = read("PATCH_11.md");
const readme = read("README.md");

requireCheck(!css.includes("TVTime Ultra"), "legacy dark-only Ultra overrides remain in globals.css");
requireCheck(css.includes("--app-page-background") && css.includes("--app-surface-strong"), "semantic application surface tokens are missing");
requireCheck(css.includes("--color-destructive-foreground") && css.includes("--destructive-foreground"), "semantic destructive foreground token is missing");
requireCheck(/\.light\s*\{[\s\S]*color-scheme:\s*light/.test(css), "light theme does not own a complete color-scheme override");
requireCheck(/:root\s*\{[\s\S]*color-scheme:\s*dark/.test(css), "dark theme color scheme is not declared");
requireCheck(/@media \(hover: none\), \(pointer: coarse\)[\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/.test(css), "coarse-pointer controls do not enforce 44px targets");
requireCheck(/@media \(prefers-reduced-motion: reduce\)/.test(css), "reduced-motion fallback is missing");
requireCheck(/@media \(forced-colors: active\)/.test(css), "forced-colors fallback is missing");
requireCheck(/--font-arabic/.test(css) && /\[dir="rtl"\]/.test(css), "Arabic font/direction foundation is missing");
requireCheck(/@supports not \(\(backdrop-filter/.test(css), "glass surfaces lack a no-backdrop-filter fallback");

requireCheck(/icon:\s*"\/logo\.svg"/.test(layout), "root metadata still uses a poster as the app icon");
requireCheck(/colorScheme:\s*"dark light"/.test(layout), "viewport color scheme is missing");
requireCheck(/<html lang="en" dir="ltr"/.test(layout), "document language and direction are not explicit");
requireCheck(/min-h-dvh/.test(layout), "root body does not use dynamic viewport height");

requireCheck(/getViewMetadata/.test(shell), "AppShell does not use centralized view metadata");
requireCheck(/aria-live="polite"/.test(shell) && /routeAnnouncement/.test(shell), "SPA route changes are not announced");
requireCheck(/mainRef\.current\?\.focus\(\{ preventScroll: true \}\)/.test(shell), "main content is not focused after an in-app route change");
requireCheck(/lang=\{viewMetadata\.language\}/.test(shell) && /dir=\{viewMetadata\.direction\}/.test(shell), "view language/direction are not scoped on main");
requireCheck(/id="tvtime-main-content"/.test(shell) && /tvtime-skip-link/.test(shell), "skip-link target is missing");

requireCheck(/getViewLabel/.test(header), "header labels are duplicated instead of using shared metadata");
requireCheck(/aria-expanded=\{mobileOpen\}/.test(header), "mobile navigation does not expose expanded state");
requireCheck(/aria-expanded=\{mobileSearchOpen\}/.test(header) && /aria-controls="tvtime-mobile-search"/.test(header), "mobile search disclosure semantics are incomplete");
requireCheck(/Notifications, \$\{notifUnread\} unread/.test(header), "notification accessible name does not include unread state");
requireCheck(/aria-label=\{`Open \$\{userName\} profile`\}/.test(header), "profile control lacks a contextual accessible name");
requireCheck(/<dl[\s\S]*Watched movies[\s\S]*Watched episodes/.test(footer), "footer viewing statistics are not semantic");

requireCheck(/default:\s*"h-10/.test(button) && /icon:\s*"size-10/.test(button), "shared button sizing foundation changed unexpectedly");
requireCheck(/touch-manipulation/.test(button) && /aria-busy:cursor-wait/.test(button), "shared button interaction states are incomplete");
requireCheck(/bg-destructive text-destructive-foreground/.test(button), "destructive button foreground is not theme-aware");
requireCheck(/h-10/.test(input) && /aria-invalid/.test(input), "shared input sizing/error state is incomplete");
requireCheck(/"aria-hidden":\s*ariaHidden\s*=\s*true/.test(skeleton) && /aria-hidden=\{ariaHidden\}/.test(skeleton), "skeleton primitive is exposed to assistive technology by default");
requireCheck(/useId/.test(emptyState) && /role="status"/.test(emptyState), "EmptyState is not labelled as a reusable status region");

requireCheck(/process\.env\.NODE_ENV !== "production"/.test(errorBoundary), "view error details are not production-gated");
requireCheck(/showTechnicalDetails/.test(errorBoundary), "view error fallback lacks guarded diagnostics");
requireCheck(!/\{error\.message\}/.test(globalError), "global error exposes raw technical details");
requireCheck(/role="alert"/.test(globalError) && /minHeight:\s*"44px"/.test(globalError), "global recovery screen is not accessible");

requireCheck((home.match(/<h1/g) || []).length === 1, "home hero must expose one primary heading");
requireCheck(/tvtime-home-hero__scrim/.test(home) && /tvtime-home-hero__overview/.test(home) && /\.tvtime-home-hero__title[\s\S]*color:\s*white/.test(css), "home hero contrast is not independent of the selected theme");
requireCheck(/Loading recently watched titles/.test(home), "home loading state lacks an accessible status");

requireCheck(/"arabic-movies"[\s\S]*language:\s*"ar"/.test(viewMetadata) || /ARABIC_VIEW[\s\S]*language:\s*"ar"/.test(viewMetadata), "Arabic routes are not mapped to Arabic metadata");
requireCheck(manifest.id === "/" && manifest.lang === "en" && manifest.dir === "ltr", "PWA manifest identity/language/direction is incomplete");
requireCheck(Array.isArray(manifest.categories) && manifest.categories.includes("entertainment"), "PWA manifest categories are missing");

const patchCommand = String(pkg.scripts?.["verify:patch-11"] || "");
requireCheck(patchCommand.includes("test-patch-11") && patchCommand.includes("verify-patch-11"), "Patch 11 checks are not wired into package.json");
requireCheck(/Patch 11 behavior tests/.test(verifyAll) && /Patch 11 source guards/.test(verifyAll), "Patch 11 is not included in verify:all");
requireCheck(/\| 11 \|/.test(patchPlan), "PATCH_PLAN.md does not track Patch 11");
requireCheck(/No database migration/.test(patchNotes) && /No API contract change/.test(patchNotes), "Patch 11 non-goals are not documented");
requireCheck(/Patch 11/.test(readme) && /npm run verify:patch-11/.test(readme), "README does not document the UI foundation gate");

if (failures.length > 0) {
  console.error("[patch-11] verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[patch-11] Theme-aware surfaces, shared controls, route accessibility, RTL metadata, resilient states and documentation are present.");
