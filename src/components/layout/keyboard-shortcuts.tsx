"use client";

import { useEffect, useRef, useState } from "react";
import { useNav } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  description: string;
}

const SHORTCUTS: { group: string; items: ShortcutItem[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: ["g", "h"], description: "Go to Home" },
      { keys: ["g", "d"], description: "Go to Discover" },
      { keys: ["g", "m"], description: "Go to Movies" },
      { keys: ["g", "t"], description: "Go to TV Shows" },
      { keys: ["g", "a"], description: "Go to Anime" },
      { keys: ["g", "c"], description: "Go to Calendar" },
      { keys: ["g", "s"], description: "Go to Stats" },
    ],
  },
  {
    group: "Search & Back",
    items: [
      { keys: ["/"], description: "Focus search bar" },
      { keys: ["s"], description: "Focus search bar (alternative)" },
      { keys: ["Esc"], description: "Go back / blur input" },
    ],
  },
  {
    group: "Help",
    items: [
      { keys: ["?"], description: "Show this shortcuts dialog" },
    ],
  },
];

export function KeyboardShortcuts() {
  const { view, setView, back, history } = useNav();
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const [helpOpen, setHelpOpen] = useState(false);

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
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (isTyping) {
          (target as HTMLElement).blur();
        } else if (view !== "home" && history.length > 0) {
          back();
        }
        return;
      }

      // Don't trigger shortcuts when typing
      if (isTyping) return;

      // "?" to show help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      // Resolve an active "g" navigation sequence before standalone keys.
      // Otherwise the second key in "g s" is consumed by the search shortcut.
      const now = Date.now();
      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 1500) {
        switch (e.key.toLowerCase()) {
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
          case "m":
            e.preventDefault();
            setView("movies");
            break;
          case "t":
            e.preventDefault();
            setView("tv-shows");
            break;
          case "a":
            e.preventDefault();
            setView("anime");
            break;
          case "c":
            e.preventDefault();
            setView("calendar");
            break;
        }
        lastKeyRef.current = "";
        return;
      }

      // "/" or "s" to focus search when not completing a "g" sequence.
      if (e.key === "/" || e.key.toLowerCase() === "s") {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Search movies"]') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      // "g" prefix for navigation (g h, g d, g m, g t, g a, g s, g c)
      if (e.key.toLowerCase() === "g") {
        lastKeyRef.current = "g";
        lastKeyTimeRef.current = now;
        return;
      }


      lastKeyRef.current = "";
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, history, setView, back, helpOpen]);

  return <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" /> Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>Press these keys anywhere to navigate faster</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</h4>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.description} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground/90">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground text-xs">then</span>}
                          <kbd className="min-w-[28px] h-7 px-2 inline-flex items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold font-mono shadow-sm">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/40">
          Tip: shortcuts don't trigger while typing in input fields
        </p>
      </DialogContent>
    </Dialog>
  );
}
