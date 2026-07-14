"use client";

import { useNav, type ViewName } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Home,
  Search,
  CalendarDays,
  BarChart3,
  Film,
  Menu,
  X,
  Sun,
  Moon,
  ArrowLeft,
  Keyboard,
  Clapperboard,
  Sparkles,
  Languages,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProfileDialog } from "@/components/profile/profile-dialog";
import { ShortcutsHelpDialog } from "@/components/layout/keyboard-shortcuts";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

/**
 * Header redesign — clean, grouped, professional.
 *
 * Layout (desktop):
 *   [Logo] [Home] [Discover] │ [Movies] [TV] [Anime] │ [Ar.Movies] [Ar.TV] │ [Calendar] [Stats]     [Search] [🌙] [⌨] [Avatar]
 *
 * Groups are separated by thin visual dividers. Each group has a logical
 * relationship:
 *   - Navigation: Home, Discover
 *   - Library: Movies, TV Shows, Anime
 *   - Arabic: Arabic Movies, Arabic TV
 *   - Tools: Calendar, Stats
 *
 * "Search" as a nav item was removed — the search bar IS the search.
 * Redundant to have both.
 *
 * On medium screens (lg), icons only with tooltips.
 * On large screens (xl), icons + text labels.
 * On mobile (<lg), hamburger menu with grouped sections.
 */

type NavItem = { view: ViewName; label: string; shortLabel: string; icon: React.ElementType };
type NavGroup = { items: NavItem[]; separator?: boolean };

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { view: "home", label: "Home", shortLabel: "Home", icon: Home },
    ],
  },
  {
    separator: true,
    items: [
      { view: "movies", label: "Movies", shortLabel: "Movies", icon: Film },
      { view: "tv-shows", label: "TV Shows", shortLabel: "TV", icon: Clapperboard },
      { view: "anime", label: "Anime", shortLabel: "Anime", icon: Sparkles },
    ],
  },
  {
    separator: true,
    items: [
      { view: "arabic-movies", label: "Arabic Movies", shortLabel: "Ar.Movies", icon: Film },
      { view: "arabic-tv", label: "Arabic TV", shortLabel: "Ar.TV", icon: Clapperboard },
    ],
  },
  {
    separator: true,
    items: [
      { view: "calendar", label: "Calendar", shortLabel: "Calendar", icon: CalendarDays },
      { view: "stats", label: "Stats", shortLabel: "Stats", icon: BarChart3 },
    ],
  },
];

// Flat list for mobile menu
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// Mobile menu groups with labels
const MOBILE_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Home", items: NAV_GROUPS[0].items },
  { label: "Library", items: NAV_GROUPS[1].items },
  { label: "Arabic", items: NAV_GROUPS[2].items },
  { label: "Tools", items: NAV_GROUPS[3].items },
];

export function Header() {
  const { view, setView, setSearchQuery, back, history, userName } = useNav();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      setSearchQuery(searchVal.trim());
      setView("search");
      setMobileOpen(false);
    }
  };

  const goTo = (v: ViewName) => {
    setView(v);
    setMobileOpen(false);
  };

  const isArabicView = (v: string) => v === "arabic-movies" || v === "arabic-tv";

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        {/* Mobile menu trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
            <SheetHeader className="p-4 border-b border-border/60">
              <SheetTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-gradient font-extrabold text-lg">TvTime</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="p-3 flex flex-col gap-4">
              {MOBILE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1.5">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.view}
                        onClick={() => goTo(item.view)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          view === item.view
                            ? isArabicView(item.view)
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-primary text-primary-foreground"
                            : "hover:bg-accent text-foreground/80"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 flex-shrink-0"
          aria-label="TvTime home"
          aria-current={view === "home" ? "page" : undefined}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Film className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-gradient font-extrabold text-lg sm:text-xl hidden sm:block">TvTime</span>
        </button>

        {/* Desktop nav — grouped with separators */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {group.separator && (
                <div className="w-px h-5 bg-border/50 mx-1" aria-hidden />
              )}
              {group.items.map((item) => {
                const active = view === item.view;
                const arabic = isArabicView(item.view);
                return (
                  <TooltipProvider key={item.view}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => goTo(item.view)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg transition-colors",
                            // Icon-only on lg, icon+text on xl
                            "px-2.5 py-2 xl:px-3",
                            active
                              ? arabic
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-primary/15 text-primary"
                              : "hover:bg-accent text-foreground/70"
                          )}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm font-medium hidden xl:inline whitespace-nowrap">
                            {item.shortLabel}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="xl:hidden">
                        <p className="text-xs">{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={onSubmitSearch} className="flex-1 max-w-sm ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search..."
              className="pl-9 h-9 bg-muted/50 border-border/50 focus-visible:bg-background"
            />
          </div>
        </form>

        {/* Back button (detail views only) */}
        {(view === "movie-detail" || view === "tv-detail") && history.length > 0 && (
          <Button variant="ghost" size="icon" onClick={back} className="hidden sm:flex" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Keyboard shortcuts help */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHelpOpen(true)}
          aria-label="Keyboard shortcuts"
          className="hidden sm:flex"
        >
          <Keyboard className="h-5 w-5" />
        </Button>

        {/* Avatar */}
        <button
          onClick={() => setProfileOpen(true)}
          className="flex-shrink-0"
          aria-label="Your profile"
        >
          <Avatar className="w-9 h-9 border-2 border-primary/40 hover:border-primary transition-colors">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
              {userName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}
