#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  BoundedScrollPositionCache,
  MAX_INERTIA_VELOCITY_PX_PER_MS,
  advanceInertia,
  browserScrollDeltaForPointerDelta,
  browserScrollLeftAfterDrag,
  carouselShouldAutoplay,
  clampInertiaVelocity,
  resolveHorizontalSwipe,
  shouldStartInertia,
  type CarouselAutoplayState,
} from "../src/hooks/horizontal-gesture-physics.ts";

const autoplayState: CarouselAutoplayState = {
  itemCount: 5,
  reducedMotion: false,
  interacting: false,
  documentVisible: true,
};

assert.equal(carouselShouldAutoplay(autoplayState), true, "A visible carousel may autoplay continuously");
for (const pausedState of [
  { reducedMotion: true },
  { interacting: true },
  { documentVisible: false },
  { itemCount: 1 },
] satisfies Array<Partial<CarouselAutoplayState>>) {
  assert.equal(
    carouselShouldAutoplay({ ...autoplayState, ...pausedState }),
    false,
    `Autoplay must pause for ${JSON.stringify(pausedState)}`,
  );
}

assert.equal(resolveHorizontalSwipe(-60, 4, 48, "ltr"), 1, "An LTR left swipe advances");
assert.equal(resolveHorizontalSwipe(60, 4, 48, "ltr"), -1, "An LTR right swipe goes back");
assert.equal(resolveHorizontalSwipe(-60, 4, 48, "rtl"), -1, "An RTL left swipe goes back");
assert.equal(resolveHorizontalSwipe(60, 4, 48, "rtl"), 1, "An RTL right swipe advances");
assert.equal(resolveHorizontalSwipe(47, 0, 48, "ltr"), null, "Sub-threshold motion remains a click");
assert.equal(resolveHorizontalSwipe(60, 80, 48, "ltr"), null, "Vertical page gestures must not change slides");

assert.equal(
  browserScrollLeftAfterDrag(120, 40),
  80,
  "An LTR rightward drag decreases the browser scroll position so content follows the pointer",
);
assert.equal(
  browserScrollLeftAfterDrag(0, 40),
  -40,
  "A standards-based RTL rail may move from inline-start 0 into its negative scroll range",
);
assert.equal(
  browserScrollDeltaForPointerDelta(-25),
  25,
  "A leftward pointer fling preserves its browser scrollLeft direction for inertia",
);
assert.equal(browserScrollDeltaForPointerDelta(Number.NaN), 0, "Invalid pointer movement must be inert");

assert.equal(clampInertiaVelocity(Number.NaN), 0, "Invalid velocity must be inert");
assert.equal(
  clampInertiaVelocity(20),
  MAX_INERTIA_VELOCITY_PX_PER_MS,
  "A fast pointer fling must be capped",
);
assert.equal(shouldStartInertia(0.5, false, 20), true, "A recent mouse/pen fling may coast");
assert.equal(shouldStartInertia(0.5, true, 20), false, "Reduced motion disables inertia");
assert.equal(shouldStartInertia(0.5, false, 120), false, "Releasing after a pause must not coast");

const positiveFrame = advanceInertia(0.8, 16);
assert.ok(positiveFrame.delta > 0, "Positive velocity must preserve direction");
assert.ok(positiveFrame.velocity > 0 && positiveFrame.velocity < 0.8, "Inertia must decay each frame");
const negativeFrame = advanceInertia(-0.8, 16);
assert.ok(negativeFrame.delta < 0, "Negative/RTL velocity must preserve direction");
assert.ok(Math.abs(negativeFrame.velocity) < 0.8, "Negative inertia must decay safely");

const rememberedPositions = new BoundedScrollPositionCache(2);
rememberedPositions.set("home:first", 120);
rememberedPositions.set("home:second", -48);
assert.equal(rememberedPositions.get("home:first"), 120, "A rail position is restored by its stable key");
rememberedPositions.set("home:third", 320);
assert.equal(rememberedPositions.get("home:second"), undefined, "The least-recently-used rail is evicted");
assert.equal(rememberedPositions.get("home:first"), 120, "Reading a rail keeps it in the bounded cache");
assert.equal(rememberedPositions.get("home:third"), 320, "The newest rail remains available");
rememberedPositions.set("invalid", Number.NaN);
assert.equal(rememberedPositions.size, 2, "Invalid positions cannot grow the cache");

console.log("PASS: Horizontal carousel autoplay, swipe direction, bounded inertia, and rail restoration behavior");
