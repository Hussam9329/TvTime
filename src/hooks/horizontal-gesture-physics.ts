export type ReadingDirection = "ltr" | "rtl";

export type CarouselAutoplayState = {
  itemCount: number;
  reducedMotion: boolean;
  interacting: boolean;
  documentVisible: boolean;
};

export function carouselShouldAutoplay(state: CarouselAutoplayState) {
  return state.itemCount > 1
    && !state.reducedMotion
    && !state.interacting
    && state.documentVisible;
}

export function resolveHorizontalSwipe(
  deltaX: number,
  deltaY: number,
  threshold: number,
  direction: ReadingDirection,
): -1 | 1 | null {
  const horizontalDistance = Math.abs(deltaX);
  if (horizontalDistance < threshold || horizontalDistance <= Math.abs(deltaY)) return null;

  const ltrDirection: -1 | 1 = deltaX > 0 ? -1 : 1;
  return direction === "rtl" ? (ltrDirection * -1) as -1 | 1 : ltrDirection;
}

/**
 * Pointer dragging is physical rather than logical: content follows the
 * pointer, so the browser's raw scrollLeft always moves by -pointerDelta.
 * Modern browsers expose RTL inline-start as 0 and inline-end as negative;
 * applying a second RTL sign flip would therefore clamp the first drag at 0.
 */
export function browserScrollDeltaForPointerDelta(pointerDelta: number) {
  return Number.isFinite(pointerDelta) ? -pointerDelta : 0;
}

export function browserScrollLeftAfterDrag(startScrollLeft: number, pointerDelta: number) {
  const safeStart = Number.isFinite(startScrollLeft) ? startScrollLeft : 0;
  return safeStart + browserScrollDeltaForPointerDelta(pointerDelta);
}

export const MAX_INERTIA_VELOCITY_PX_PER_MS = 1.8;
export const MIN_INERTIA_VELOCITY_PX_PER_MS = 0.045;
export const INERTIA_FRAME_MS = 1000 / 60;
export const INERTIA_FRICTION_PER_FRAME = 0.92;

export function clampInertiaVelocity(velocity: number) {
  if (!Number.isFinite(velocity)) return 0;
  return Math.max(-MAX_INERTIA_VELOCITY_PX_PER_MS, Math.min(MAX_INERTIA_VELOCITY_PX_PER_MS, velocity));
}

export function shouldStartInertia(velocity: number, reducedMotion: boolean, millisecondsSinceMove: number) {
  return !reducedMotion
    && millisecondsSinceMove <= 80
    && Math.abs(clampInertiaVelocity(velocity)) >= MIN_INERTIA_VELOCITY_PX_PER_MS;
}

export function advanceInertia(velocity: number, elapsedMs: number) {
  const safeElapsed = Math.max(0, Math.min(elapsedMs, 32));
  const nextVelocity = clampInertiaVelocity(velocity)
    * Math.pow(INERTIA_FRICTION_PER_FRAME, safeElapsed / INERTIA_FRAME_MS);

  return {
    delta: nextVelocity * safeElapsed,
    velocity: nextVelocity,
    finished: Math.abs(nextVelocity) < MIN_INERTIA_VELOCITY_PX_PER_MS,
  };
}

export const MAX_REMEMBERED_SCROLL_POSITIONS = 64;

/**
 * Small in-memory LRU used by horizontal rails. Keeping this module-local in
 * the browser restores SPA back-navigation without reading storage during
 * hydration (which would visibly move an already-painted rail).
 */
export class BoundedScrollPositionCache {
  readonly capacity: number;
  private readonly positions = new Map<string, number>();

  constructor(capacity = MAX_REMEMBERED_SCROLL_POSITIONS) {
    this.capacity = Number.isFinite(capacity) ? Math.max(1, Math.floor(capacity)) : 1;
  }

  get size() {
    return this.positions.size;
  }

  get(key: string) {
    const position = this.positions.get(key);
    if (position === undefined) return undefined;

    // A read makes this the most-recently-used entry.
    this.positions.delete(key);
    this.positions.set(key, position);
    return position;
  }

  set(key: string, position: number) {
    if (!key || !Number.isFinite(position)) return;

    this.positions.delete(key);
    this.positions.set(key, position);
    while (this.positions.size > this.capacity) {
      const oldestKey = this.positions.keys().next().value;
      if (oldestKey === undefined) break;
      this.positions.delete(oldestKey);
    }
  }
}
