import assert from "node:assert/strict";
import {
  VIEW_METADATA,
  getViewLabel,
  getViewMetadata,
  isArabicView,
} from "../src/lib/view-metadata.ts";

const expectedViews = [
  "home",
  "watch-next",
  "discover",
  "search",
  "movie-detail",
  "tv-detail",
  "person-detail",
  "movies",
  "anime",
  "stats",
  "tv-shows",
  "arabic-movies",
  "arabic-tv",
] as const;

assert.deepEqual(
  Object.keys(VIEW_METADATA).sort(),
  [...expectedViews].sort(),
  "Every routable view must have shared metadata",
);

for (const view of expectedViews) {
  const metadata = getViewMetadata(view);
  assert.ok(metadata.label.trim().length > 0, `${view} needs a visible label`);
  assert.ok(metadata.accessibleLabel.trim().length > 0, `${view} needs an accessible label`);
  assert.ok(metadata.announcement.trim().length > 0, `${view} needs a route announcement`);
  assert.ok(["en", "ar"].includes(metadata.language), `${view} has an unsupported language`);
  assert.ok(["ltr", "rtl"].includes(metadata.direction), `${view} has an unsupported direction`);
}

assert.equal(getViewLabel("person-detail"), "Person Details");
assert.equal(isArabicView("arabic-movies"), true);
assert.equal(isArabicView("arabic-tv"), true);
assert.equal(isArabicView("movies"), false);
assert.deepEqual(
  {
    language: getViewMetadata("arabic-movies").language,
    direction: getViewMetadata("arabic-movies").direction,
  },
  { language: "ar", direction: "rtl" },
);
assert.deepEqual(
  {
    language: getViewMetadata("home").language,
    direction: getViewMetadata("home").direction,
  },
  { language: "en", direction: "ltr" },
);

console.log("Patch 11 behavior tests passed.");
