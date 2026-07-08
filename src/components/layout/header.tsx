"use client";

import { useNav, type ViewName } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Home,
  Compass,
  Search,
  CalendarDays,
  Library,
  BarChart3,
  Film,
  Menu,
  X,
  Sun,
  Moon,
  ArrowLeft,
  Keyboard,
  Database,
  Clapperboard,
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

const navItems: { view: ViewName; label: string; icon: React.ElementType }[] = [
  { view: "home", label: "Home", icon: Home },
  { view: "discover", label: "Discover", icon: Compass },
  { view: "search", label: "Search", icon: Search },
  { view: "tv-tracking", label: "TV Track", icon: Clapperboard },
  { view: "calendar", label: "Calendar", icon: CalendarDays },
  { view: "library", label: "Library", icon: Library },
  { view: "stats", label: "Stats", icon: BarChart3 },
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 border-b border-border/60">
              <SheetTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-gradient font-extrabold text-lg">CineTrack</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="p-3 flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => goTo(item.view)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    view === item.view
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground/80"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 flex-shrink-0"
          aria-label="CineTrack home"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Film className="w-5 h-5 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          <span className="text-gradient font-extrabold text-lg sm:text-xl hidden sm:block">CineTrack</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => goTo(item.view)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                view === item.view
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-accent text-foreground/70"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={onSubmitSearch} className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search movies, shows..."
              className="pl-9 h-9 bg-muted/50 border-border/50 focus-visible:bg-background"
            />
          </div>
        </form>

        {/* Back button (shown on detail views) */}
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHelpOpen(true)}
                aria-label="Keyboard shortcuts"
                className="hidden sm:flex relative"
              >
                <Keyboard className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Keyboard shortcuts <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px] font-mono">?</kbd></p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
