"use client";

import { useState } from "react";
import { useAppStore, type ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./notification-center";
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
  Bell,
  List as ListIcon,
  BookOpen,
} from "lucide-react";

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

const SECONDARY_NAV: { key: ViewKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "diary", label: "سجل المشاهدة", icon: BookOpen },
  { key: "lists", label: "القوائم", icon: ListIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentView, setView, notifications } = useAppStore();
  const [libOpen, setLibOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isLibraryView = LIBRARY_TABS.some((t) => t.key === currentView);
  const isSecondaryView = SECONDARY_NAV.some((t) => t.key === currentView);
  const unreadCount = notifications.filter((n) => !n.read).length;

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

            {/* Library dropdown */}
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

            {/* Secondary nav (Diary + Lists) */}
            {SECONDARY_NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                  currentView === n.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <n.icon size={15} />
                {n.label}
              </button>
            ))}
          </nav>

          {/* Right side: notifications + avatar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNotifOpen(true)}
              className="relative w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent"
              title="الإشعارات"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
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
            { key: "home" as ViewKey, label: "الرئيسية", icon: Home },
            { key: "search" as ViewKey, label: "بحث", icon: Search },
            { key: "library" as ViewKey, label: "مكتبتي", icon: Library },
            { key: "diary" as ViewKey, label: "السجل", icon: BookOpen },
            { key: "stats" as ViewKey, label: "إحصائي", icon: BarChart3 },
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
                  "flex flex-col items-center justify-center gap-0.5 relative",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <n.icon size={20} />
                <span className="text-[10px] font-medium">{n.label}</span>
                {n.key === "library" && isLibraryView && (
                  <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Notification center */}
      {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
    </div>
  );
}
