"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  carouselShouldAutoplay,
  resolveHorizontalSwipe,
  type ReadingDirection,
} from "@/hooks/horizontal-gesture-physics";

export const HERO_CAROUSEL_INTERVAL_MS = 7000;
const HERO_SWIPE_THRESHOLD_PX = 48;
const SWIPE_BLOCKING_SELECTOR = [
  "[data-carousel-controls]",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
].join(",");

type HeroCarouselOptions = {
  itemCount: number;
  reducedMotion?: boolean | null;
  direction?: ReadingDirection;
  intervalMs?: number;
};

type SwipeGesture = {
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
};

function isSwipeBlockedTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(SWIPE_BLOCKING_SELECTOR) !== null;
}

export function useHeroCarousel({
  itemCount,
  reducedMotion = false,
  direction = "ltr",
  intervalMs = HERO_CAROUSEL_INTERVAL_MS,
}: HeroCarouselOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cycleVersion, setCycleVersion] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const swipe = useRef<SwipeGesture>({ active: false, pointerId: -1, startX: 0, startY: 0 });
  const suppressClick = useRef(false);
  const suppressClickTimer = useRef<number | null>(null);
  const wasAutoplaying = useRef(false);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(document.visibilityState !== "hidden");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(itemCount - 1, 0)));
  }, [itemCount]);

  useEffect(() => () => {
    if (suppressClickTimer.current !== null) window.clearTimeout(suppressClickTimer.current);
  }, []);

  const autoplaying = carouselShouldAutoplay({
    itemCount,
    reducedMotion: Boolean(reducedMotion),
    interacting,
    documentVisible,
  });

  useEffect(() => {
    if (autoplaying && !wasAutoplaying.current) {
      setCycleVersion((current) => current + 1);
    }
    wasAutoplaying.current = autoplaying;
  }, [autoplaying]);

  useEffect(() => {
    if (!autoplaying) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % itemCount);
      setCycleVersion((current) => current + 1);
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplaying, cycleVersion, intervalMs, itemCount]);

  const moveSlide = useCallback((slideDirection: -1 | 1) => {
    if (itemCount < 2) return;
    setActiveIndex((current) => (current + slideDirection + itemCount) % itemCount);
    setCycleVersion((current) => current + 1);
  }, [itemCount]);

  const selectSlide = useCallback((index: number) => {
    if (itemCount < 1) return;
    setActiveIndex(Math.max(0, Math.min(index, itemCount - 1)));
    setCycleVersion((current) => current + 1);
  }, [itemCount]);

  const clearSuppressedClickSoon = useCallback(() => {
    if (suppressClickTimer.current !== null) window.clearTimeout(suppressClickTimer.current);
    suppressClickTimer.current = window.setTimeout(() => {
      suppressClick.current = false;
      suppressClickTimer.current = null;
    }, 0);
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" || !event.isPrimary || isSwipeBlockedTarget(event.target)) return;
    swipe.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setInteracting(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!swipe.current.active || swipe.current.pointerId !== event.pointerId) return;
    const swipeDirection = resolveHorizontalSwipe(
      event.clientX - swipe.current.startX,
      event.clientY - swipe.current.startY,
      HERO_SWIPE_THRESHOLD_PX,
      direction,
    );
    if (swipeDirection !== null && event.cancelable) event.preventDefault();
  }, [direction]);

  const finishSwipe = useCallback((event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    if (!swipe.current.active || swipe.current.pointerId !== event.pointerId) return;
    const gesture = swipe.current;
    swipe.current = { active: false, pointerId: -1, startX: 0, startY: 0 };
    setInteracting(false);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) return;

    const swipeDirection = resolveHorizontalSwipe(
      event.clientX - gesture.startX,
      event.clientY - gesture.startY,
      HERO_SWIPE_THRESHOLD_PX,
      direction,
    );
    if (swipeDirection === null) return;

    suppressClick.current = true;
    if (event.cancelable) event.preventDefault();
    moveSlide(swipeDirection);
    clearSuppressedClickSoon();
  }, [clearSuppressedClickSoon, direction, moveSlide]);

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    if (suppressClickTimer.current !== null) {
      window.clearTimeout(suppressClickTimer.current);
      suppressClickTimer.current = null;
    }
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const progressStyle = useMemo(() => ({
    "--tvtime-carousel-duration": `${intervalMs}ms`,
    "--tvtime-carousel-play-state": autoplaying ? "running" : "paused",
  }) as CSSProperties, [autoplaying, intervalMs]);

  return {
    activeIndex,
    cycleVersion,
    isPaused: !autoplaying,
    intervalMs,
    moveSlide,
    selectSlide,
    progressStyle,
    rootProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp(event: ReactPointerEvent<HTMLElement>) {
        finishSwipe(event, false);
      },
      onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
        finishSwipe(event, true);
      },
      onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) {
        finishSwipe(event, true);
      },
      onClickCapture,
    },
  };
}
