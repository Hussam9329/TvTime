"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from "react";

/**
 * Adds mouse and pen dragging to a native horizontal scroller. Touch remains
 * native so iOS/Android keep their momentum scrolling and vertical gestures.
 */
export function useHorizontalDragScroll() {
  const gesture = useRef({ active: false, startX: 0, startScrollLeft: 0, pointerId: -1, rtl: false });
  const suppressClick = useRef(false);

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture.current.active) return;
    gesture.current.active = false;
    event.currentTarget.classList.remove("is-pointer-dragging");
    if (event.currentTarget.hasPointerCapture(gesture.current.pointerId)) {
      event.currentTarget.releasePointerCapture(gesture.current.pointerId);
    }
  };

  return {
      onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.pointerType === "touch" || event.button !== 0) return;
        gesture.current = {
          active: true,
          startX: event.clientX,
          startScrollLeft: event.currentTarget.scrollLeft,
          pointerId: event.pointerId,
          rtl: window.getComputedStyle(event.currentTarget).direction === "rtl",
        };
        suppressClick.current = false;
      },
      onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!gesture.current.active) return;
        const distance = event.clientX - gesture.current.startX;
        if (!suppressClick.current && Math.abs(distance) < 5) return;
        suppressClick.current = true;
        event.currentTarget.classList.add("is-pointer-dragging");
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.currentTarget.scrollLeft = gesture.current.startScrollLeft + distance * (gesture.current.rtl ? 1 : -1);
        event.preventDefault();
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
        if (gesture.current.active && !event.currentTarget.hasPointerCapture(gesture.current.pointerId)) finish(event);
      },
      onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
      onDragStart(event: ReactDragEvent<HTMLDivElement>) {
        event.preventDefault();
      },
  };
}
