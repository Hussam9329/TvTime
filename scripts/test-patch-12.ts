import assert from "node:assert/strict";

import {
  DETAIL_VIEWS,
  MOBILE_DOCK_VIEWS,
  PRIMARY_NAV_VIEWS,
  SECONDARY_NAV_VIEWS,
  isDetailView,
  isMobileDockView,
} from "../src/lib/navigation-layout.ts";
import { getViewLabel } from "../src/lib/view-metadata.ts";

assert.deepEqual(
  PRIMARY_NAV_VIEWS,
  ["home", "watch-next", "discover", "movies", "tv-shows", "anime"],
  "Desktop navigation must preserve the intended product hierarchy",
);
assert.deepEqual(
  SECONDARY_NAV_VIEWS,
  ["stats", "arabic-movies", "arabic-tv"],
  "Secondary destinations must remain available without crowding primary navigation",
);
assert.deepEqual(
  MOBILE_DOCK_VIEWS,
  ["home", "watch-next", "discover", "movies", "tv-shows"],
  "The mobile dock must expose the five highest-frequency destinations",
);
assert.deepEqual(
  DETAIL_VIEWS,
  ["movie-detail", "tv-detail", "person-detail"],
  "All detail routes must use the focused detail layout",
);

const desktopDestinations = [...PRIMARY_NAV_VIEWS, ...SECONDARY_NAV_VIEWS];
assert.equal(
  new Set(desktopDestinations).size,
  desktopDestinations.length,
  "Desktop navigation destinations must not be duplicated",
);
assert.ok(
  MOBILE_DOCK_VIEWS.every((view) => PRIMARY_NAV_VIEWS.includes(view)),
  "Every mobile dock destination must also exist in primary desktop navigation",
);
assert.ok(
  MOBILE_DOCK_VIEWS.length <= 5,
  "The mobile dock must stay concise enough for one-handed use",
);

for (const view of desktopDestinations) {
  assert.ok(getViewLabel(view).trim().length > 0, `${view} requires a shared visible label`);
}
for (const view of DETAIL_VIEWS) {
  assert.equal(isDetailView(view), true, `${view} must be detected as a detail route`);
  assert.equal(isMobileDockView(view), false, `${view} must not appear in the mobile dock`);
}
for (const view of MOBILE_DOCK_VIEWS) {
  assert.equal(isMobileDockView(view), true, `${view} must be recognized as a dock destination`);
  assert.equal(isDetailView(view), false, `${view} must not be treated as a detail route`);
}
assert.equal(isDetailView("home"), false);
assert.equal(isMobileDockView("anime"), false);

console.log("Patch 12 navigation hierarchy tests passed.");
