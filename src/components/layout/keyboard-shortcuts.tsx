"use client";

import { useEffect, useRef } from "react";
import { useNav } from "@/lib/store";

/**
 * Global keyboard shortcuts for navigation:
 * - "/" or "s": focus search input
 * - "Esc": go back (if in detail view) or clear search
 * - "g h": go home
 * - "g d": go discover
 * - "g s": go stats
 * - "g l": go library
 * - "g c": go calendar
 * - "?": show shortcuts hint (toast)
 */
export function KeyboardShortcuts() {
  const { view, setView, back, history } = useNav();
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "SELECT";

      // Esc works even when typing
      if (e.key === "Escape") {
        if (isTyping) {
          (target as HTMLElement).blur();
        } else if (view !== "home" && history.length > 0) {
          back();
        }
        return;
      }

      // Don't trigger shortcuts when typing
      if (isTyping) return;

      // "/" or "s" to focus search
      if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Search movies"]') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      // "g" prefix for navigation (g h, g d, g s, g l, g c)
      const now = Date.now();
      if (e.key === "g" && now - lastKeyTimeRef.current > 1500) {
        lastKeyRef.current = "g";
        lastKeyTimeRef.current = now;
        return;
      }

      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 1500) {
        switch (e.key) {
          case "h":
            e.preventDefault();
            setView("home");
            break;
          case "d":
            e.preventDefault();
            setView("discover");
            break;
          case "s":
            e.preventDefault();
            setView("stats");
            break;
          case "l":
            e.preventDefault();
            setView("library");
            break;
          case "c":
            e.preventDefault();
            setView("calendar");
            break;
        }
        lastKeyRef.current = "";
        return;
      }

      lastKeyRef.current = "";
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, history, setView, back]);

  return null;
}
