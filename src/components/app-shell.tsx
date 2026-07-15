"use client";

import { useAppStore, type ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Home,
  Search,
  Calendar,
  Library,
  BarChart3,
  Film,
  Tv,
  Sparkles,
  Clapperboard,
} from "lucide-react";
import { useState } from "react";

const PRIMARY_NAV: { key: ViewKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "home", label: "الرئيسية", icon: Home },
  { key: "search", label: "بحث", icon: Search },
  { key: "stats", label: "إحصائيات", icon: BarChart3 },
];

const LIBRARY_TABS: { key: ViewKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "tvshows", label: "مسلسلات", icon: Tv },
  { key: "movies", label: "أفلام", icon: Film },
  { key: "anime", label: "أنمي", icon: Sparkles },
  { key: "arabic_tv", label: "مسلسلات عربية", icon: Tv },
  { key: "arabic_movies", label: "أفلام عربية", icon: Clapperboard },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentView, setView } = useAppStore();
  const [libOpen, setLibOpen] = useState(false);

  const isLibraryView = LIBRARY_TABS.some((t) => t.key === currentView);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              T
            </div>
            <span className="font-bold text-base">TvTime+</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {PRIMARY_NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  currentView === n.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => setLibOpen(!libOpen)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                isLibraryView || libOpen
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Library size={15} />
              مكتبتي
            </button>
          </nav>

          {/* User avatar placeholder */}
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
              M
            </button>
          </div>
        </div>

        {/* Desktop library dropdown */}
        {libOpen && (
          <div className="hidden md:block border-t border-border bg-background">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-1 overflow-x-auto">
              {LIBRARY_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setView(t.key);
                    setLibOpen(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                    currentView === t.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="grid grid-cols-5 h-16">
          {[
            ...PRIMARY_NAV.slice(0, 2),
            { key: "library" as ViewKey, label: "مكتبتي", icon: Library },
            ...PRIMARY_NAV.slice(2),
          ].map((n) => {
            const isActive =
              n.key === "library" ? isLibraryView : currentView === n.key;
            return (
              <button
                key={n.key}
                onClick={() => {
                  if (n.key === "library") {
                    setView("tvshows");
                  } else {
                    setView(n.key as ViewKey);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <n.icon size={20} />
                <span className="text-[10px] font-medium">{n.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
