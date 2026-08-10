"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type UIEvent as ReactUIEvent,
} from "react";
import {
  advanceInertia,
  BoundedScrollPositionCache,
  browserScrollDeltaForPointerDelta,
  browserScrollLeftAfterDrag,
  clampInertiaVelocity,
  shouldStartInertia,
} from "@/hooks/horizontal-gesture-physics";

const CLICK_SUPPRESSION_THRESHOLD_PX = 5;
const rememberedScrollPositions = new BoundedScrollPositionCache();

type HorizontalDragScrollOptions = {
  /** Stable route + shelf identity used for SPA back-navigation restoration. */
  scrollKey?: string;
  /** Required with scrollKey so restoration can happen before the next paint. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Re-run restoration when a conditional/loading rail attaches or changes. */
  restoreDependency?: unknown;
};

type GestureState = {
  active: boolean;
  dragged: boolean;
  startX: number;
  startScrollLeft: number;
  pointerId: number;
  lastX: number;
  lastMoveTime: number;
  velocity: number;
};

type TemporaryStyles = {
  cursor: string;
  userSelect: string;
  scrollBehavior: string;
  scrollSnapType: string;
};

const idleGesture = (): GestureState => ({
  active: false,
  dragged: false,
  startX: 0,
  startScrollLeft: 0,
  pointerId: -1,
  lastX: 0,
  lastMoveTime: 0,
  velocity: 0,
});

function reducedMotionPreferred() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Adds mouse and pen dragging to a native horizontal scroller. Touch remains
 * native so iOS/Android keep their momentum scrolling and vertical gestures.
 */
export function useHorizontalDragScroll({
  scrollKey,
  scrollRef,
  restoreDependency,
}: HorizontalDragScrollOptions = {}) {
  const gesture = useRef<GestureState>(idleGesture());
  const suppressClick = useRef(false);
  const suppressClickTimer = useRef<number | null>(null);
  const temporaryStyles = useRef<TemporaryStyles | null>(null);
  const inertia = useRef<{ frame: number | null; element: HTMLDivElement | null }>({ frame: null, element: null });

  const restoreTemporaryStyles = useCallback((element: HTMLDivElement | null) => {
    if (!element || !temporaryStyles.current) return;
    element.style.cursor = temporaryStyles.current.cursor;
    element.style.userSelect = temporaryStyles.current.userSelect;
    element.style.scrollBehavior = temporaryStyles.current.scrollBehavior;
    element.style.scrollSnapType = temporaryStyles.current.scrollSnapType;
    temporaryStyles.current = null;
  }, []);

  const stopInertia = useCallback((restoreStyles = true) => {
    if (inertia.current.frame !== null) window.cancelAnimationFrame(inertia.current.frame);
    const element = inertia.current.element;
    inertia.current = { frame: null, element: null };
    if (restoreStyles) restoreTemporaryStyles(element);
  }, [restoreTemporaryStyles]);

  const beginDirectManipulation = useCallback((element: HTMLDivElement) => {
    if (!temporaryStyles.current) {
      temporaryStyles.current = {
        cursor: element.style.cursor,
        userSelect: element.style.userSelect,
        scrollBehavior: element.style.scrollBehavior,
        scrollSnapType: element.style.scrollSnapType,
      };
    }
    element.style.cursor = "grabbing";
    element.style.userSelect = "none";
    element.style.scrollBehavior = "auto";
    element.style.scrollSnapType = "none";
    element.classList.add("is-pointer-dragging");
  }, []);

  const finishDirectManipulation = useCallback((element: HTMLDivElement) => {
    element.classList.remove("is-pointer-dragging");
    if (temporaryStyles.current) {
      element.style.cursor = temporaryStyles.current.cursor;
      element.style.userSelect = temporaryStyles.current.userSelect;
    }
  }, []);

  const startInertia = useCallback((element: HTMLDivElement, initialVelocity: number) => {
    stopInertia(false);
    inertia.current.element = element;
    let velocity = clampInertiaVelocity(initialVelocity);
    let previousTime = performance.now();

    const step = (now: number) => {
      const frame = advanceInertia(velocity, now - previousTime);
      previousTime = now;
      velocity = frame.velocity;
      const before = element.scrollLeft;
      element.scrollLeft += frame.delta;
      const reachedBoundary = Math.abs(element.scrollLeft - before) < 0.01;

      if (frame.finished || reachedBoundary || !element.isConnected) {
        stopInertia(true);
        return;
      }
      inertia.current.frame = window.requestAnimationFrame(step);
    };

    inertia.current.frame = window.requestAnimationFrame(step);
  }, [stopInertia]);

  useLayoutEffect(() => {
    if (!scrollKey || !scrollRef?.current) return;
    const element = scrollRef.current;
    const rememberedPosition = rememberedScrollPositions.get(scrollKey);

    if (rememberedPosition !== undefined) {
      const previousScrollBehavior = element.style.scrollBehavior;
      const previousScrollSnapType = element.style.scrollSnapType;
      element.style.scrollBehavior = "auto";
      element.style.scrollSnapType = "none";
      element.scrollLeft = rememberedPosition;
      element.style.scrollBehavior = previousScrollBehavior;
      element.style.scrollSnapType = previousScrollSnapType;
    }

    return () => {
      rememberedScrollPositions.set(scrollKey, element.scrollLeft);
    };
  }, [restoreDependency, scrollKey, scrollRef]);

  const clearSuppressedClickSoon = useCallback(() => {
    if (suppressClickTimer.current !== null) window.clearTimeout(suppressClickTimer.current);
    suppressClickTimer.current = window.setTimeout(() => {
      suppressClick.current = false;
      suppressClickTimer.current = null;
    }, 0);
  }, []);

  const finish = useCallback((event: ReactPointerEvent<HTMLDivElement>, allowInertia: boolean) => {
    if (!gesture.current.active || gesture.current.pointerId !== event.pointerId) return;
    const completedGesture = gesture.current;
    gesture.current = idleGesture();
    finishDirectManipulation(event.currentTarget);

    if (event.currentTarget.hasPointerCapture(completedGesture.pointerId)) {
      event.currentTarget.releasePointerCapture(completedGesture.pointerId);
    }

    const millisecondsSinceMove = Math.max(0, event.timeStamp - completedGesture.lastMoveTime);
    if (
      allowInertia
      && completedGesture.dragged
      && shouldStartInertia(completedGesture.velocity, reducedMotionPreferred(), millisecondsSinceMove)
    ) {
      startInertia(event.currentTarget, completedGesture.velocity);
    } else {
      restoreTemporaryStyles(event.currentTarget);
    }

    if (completedGesture.dragged) clearSuppressedClickSoon();
  }, [clearSuppressedClickSoon, finishDirectManipulation, restoreTemporaryStyles, startInertia]);

  useEffect(() => () => {
    if (suppressClickTimer.current !== null) window.clearTimeout(suppressClickTimer.current);
    stopInertia(true);
  }, [stopInertia]);

  return {
    onScroll(event: ReactUIEvent<HTMLDivElement>) {
      if (scrollKey) rememberedScrollPositions.set(scrollKey, event.currentTarget.scrollLeft);
    },
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.pointerType === "touch" || event.button !== 0 || !event.isPrimary) return;
      stopInertia(true);
      gesture.current = {
        active: true,
        dragged: false,
        startX: event.clientX,
        startScrollLeft: event.currentTarget.scrollLeft,
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastMoveTime: event.timeStamp,
        velocity: 0,
      };
      suppressClick.current = false;
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (!gesture.current.active || gesture.current.pointerId !== event.pointerId) return;
      const distance = event.clientX - gesture.current.startX;
      if (!gesture.current.dragged && Math.abs(distance) < CLICK_SUPPRESSION_THRESHOLD_PX) return;

      if (!gesture.current.dragged) beginDirectManipulation(event.currentTarget);
      gesture.current.dragged = true;
      suppressClick.current = true;

      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      const elapsed = Math.max(1, event.timeStamp - gesture.current.lastMoveTime);
      const pointerDelta = event.clientX - gesture.current.lastX;
      const scrollDelta = browserScrollDeltaForPointerDelta(pointerDelta);
      const instantaneousVelocity = scrollDelta / elapsed;
      gesture.current.velocity = clampInertiaVelocity(
        gesture.current.velocity * 0.45 + instantaneousVelocity * 0.55,
      );
      gesture.current.lastX = event.clientX;
      gesture.current.lastMoveTime = event.timeStamp;
      event.currentTarget.scrollLeft = browserScrollLeftAfterDrag(
        gesture.current.startScrollLeft,
        distance,
      );
      event.preventDefault();
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      finish(event, true);
    },
    onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
      finish(event, false);
    },
    onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
      if (gesture.current.active) finish(event, false);
    },
    onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
      if (gesture.current.active && !event.currentTarget.hasPointerCapture(gesture.current.pointerId)) {
        finish(event, false);
      }
    },
    onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      if (suppressClickTimer.current !== null) {
        window.clearTimeout(suppressClickTimer.current);
        suppressClickTimer.current = null;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart(event: ReactDragEvent<HTMLDivElement>) {
      event.preventDefault();
    },
  };
}
