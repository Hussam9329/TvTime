"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  ChevronDown,
  Clapperboard,
  Film,
  Home,
  Keyboard,
  Languages,
  ListChecks,
  Menu,
  Moon,
  Play,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useNav, type ViewName } from "@/lib/store";
import { prefetchViewModule } from "@/lib/view-prefetch";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";
import { cn } from "@/lib/utils";
import { TVTIME_SEARCH_CLOSE_EVENT, TVTIME_SEARCH_FOCUS_EVENT } from "@/lib/search-command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_NAME } from "@/lib/brand";

const ProfileDialog = dynamic(
  () => import("@/components/profile/profile-dialog").then((module) => module.ProfileDialog),
  { ssr: false },
);
const ShortcutsHelpDialog = dynamic(
  () => import("@/components/layout/keyboard-shortcuts").then((module) => module.ShortcutsHelpDialog),
  { ssr: false },
);
const NotificationCenter = dynamic(
  () => import("@/components/views/notification-center").then((module) => module.NotificationCenter),
  { ssr: false },
);

type NavItem = { view: ViewName; label: string; icon: React.ElementType };

const coreNavItems: NavItem[] = [
  { view: "home", label: "Home", icon: Home },
  { view: "movies", label: "Movies", icon: Film },
  { view: "tv-shows", label: "TV Shows", icon: Clapperboard },
  { view: "anime", label: "Anime", icon: Sparkles },
  { view: "stats", label: "Stats", icon: BarChart3 },
  { view: "lists", label: "Custom Lists", icon: ListChecks },
];

const arabicNavItems: NavItem[] = [
  { view: "arabic-movies", label: "Arabic Movies", icon: Film },
  { view: "arabic-tv", label: "Arabic TV", icon: Clapperboard },
];

const allNavItems: NavItem[] = [
  ...coreNavItems,
  { view: "search", label: "Search", icon: Search },
  ...arabicNavItems,
];

const NOTIFICATION_QUERY_KEY = ["notifications", "unread-count", getClientUserId()] as const;

function activeIn(view: ViewName, items: NavItem[]) {
  return items.some((item) => item.view === view);
}

export function Header() {
  const view = useNav((state) => state.view);
  const setView = useNav((state) => state.setView);
  const setSearchQuery = useNav((state) => state.setSearchQuery);
  const back = useNav((state) => state.back);
  const historyLength = useNav((state) => state.history.length);
  const userName = useNav((state) => state.userName);
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notificationSummary = useQuery({
    queryKey: NOTIFICATION_QUERY_KEY,
    queryFn: async () => {
      const url = withUserId(new URL("/api/notifications", window.location.origin));
      url.searchParams.set("filter", "unread");
      url.searchParams.set("countOnly", "true");
      const response = await fetch(url, { headers: userHeaders() });
      if (!response.ok) throw new Error("Failed to load notification count");
      return response.json() as Promise<{ unreadCount: number }>;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  const notifUnread = Math.max(0, Number(notificationSummary.data?.unreadCount || 0));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const focusSearch = () => {
      prefetchViewModule("search");
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      if (desktop) {
        desktopSearchInputRef.current?.focus();
        desktopSearchInputRef.current?.select();
        return;
      }
      setMobileSearchOpen(true);
      window.requestAnimationFrame(() => {
        mobileSearchInputRef.current?.focus();
        mobileSearchInputRef.current?.select();
      });
    };
    const closeSearch = () => {
      desktopSearchInputRef.current?.blur();
      mobileSearchInputRef.current?.blur();
      setMobileSearchOpen(false);
    };
    window.addEventListener(TVTIME_SEARCH_FOCUS_EVENT, focusSearch);
    window.addEventListener(TVTIME_SEARCH_CLOSE_EVENT, closeSearch);
    return () => {
      window.removeEventListener(TVTIME_SEARCH_FOCUS_EVENT, focusSearch);
      window.removeEventListener(TVTIME_SEARCH_CLOSE_EVENT, closeSearch);
    };
  }, []);

  const onSubmitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchVal.trim();
    if (!query) {
      (desktopSearchInputRef.current ?? mobileSearchInputRef.current)?.focus();
      return;
    }
    setSearchQuery(query);
    setView("search");
    setMobileOpen(false);
    setMobileSearchOpen(false);
    desktopSearchInputRef.current?.blur();
    mobileSearchInputRef.current?.blur();
  };

  const goTo = useCallback((nextView: ViewName) => {
    setView(nextView);
    setMobileOpen(false);
  }, [setView]);

  const syncUnreadCount = useCallback((unreadCount: number) => {
    queryClient.setQueryData(NOTIFICATION_QUERY_KEY, { unreadCount: Math.max(0, unreadCount) });
  }, [queryClient]);

  const currentLabel = allNavItems.find((item) => item.view === view)?.label
    ?? (view === "movie-detail" ? "Movie Details" : view === "tv-detail" ? "TV Details" : APP_NAME);
  const isDetailView = view === "movie-detail" || view === "tv-detail" || view === "person-detail";

  const navButton = (item: NavItem, compact = false) => {
    const active = item.view === view;
    return (
      <button
        data-ui-action="nav"
        key={item.view}
        type="button"
        onClick={() => goTo(item.view)}
        onPointerEnter={() => prefetchViewModule(item.view)}
        onFocus={() => prefetchViewModule(item.view)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative inline-flex items-center rounded-xl font-semibold transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
          compact ? "w-full gap-3 px-3 py-2.5 text-sm" : "tvtime-primary-nav-item gap-2 px-3 py-2 text-[13px]",
          active
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
            : "text-foreground/65 hover:bg-accent/80 hover:text-foreground",
        )}
      >
        <item.icon className={cn("shrink-0 transition-colors", compact ? "h-4.5 w-4.5" : "h-4 w-4")} />
        <span>{item.label}</span>
        {!compact && active && <span className="absolute -bottom-[9px] left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-primary" />}
      </button>
    );
  };

  return (
    <header className="tvtime-app-header sticky top-0 z-40 border-b border-border/70 bg-background/82 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/72" data-mobile-search-open={mobileSearchOpen ? "true" : "false"}>
      <div className="mx-auto flex h-15 max-w-[1600px] items-center gap-2 px-3 sm:h-16 sm:px-4 lg:px-6">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl xl:hidden" aria-label="Open navigation">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(88vw,340px)] border-r-border/70 p-0">
            <SheetHeader className="border-b border-border/60 p-5 text-left">
              <SheetTitle className="flex items-center gap-3">
                <BrandMark />
                <span>
                  <span className="block text-lg font-black tracking-tight">{APP_NAME}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Your watch universe</span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex max-h-[calc(100dvh-88px)] flex-col gap-5 overflow-y-auto p-4" aria-label="Mobile navigation">
              <NavGroup label="Explore">{coreNavItems.map((item) => navButton(item, true))}</NavGroup>
              <NavGroup label="Arabic World">{arabicNavItems.map((item) => navButton(item, true))}</NavGroup>
            </nav>
          </SheetContent>
        </Sheet>

        {isDetailView && historyLength > 0 && (
          <Button variant="ghost" size="icon" onClick={back} className="h-10 w-10 rounded-xl" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <button
          data-ui-action="brand"
          type="button"
          onClick={() => goTo("home")}
          onPointerEnter={() => prefetchViewModule("home")}
          className="group flex shrink-0 items-center gap-2 rounded-xl pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={`${APP_NAME} home`}
        >
          <BrandMark />
          <span className="tvtime-brand-copy hidden sm:block">
            <span className="block text-lg font-black leading-none tracking-[-0.04em]">Tv<span className="text-primary">Time</span></span>
          </span>
        </button>

        <nav className="tvtime-primary-nav ml-1 hidden xl:flex items-center gap-0.5" aria-label="Primary navigation">
          {coreNavItems.map((item) => navButton(item))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-ui-action="nav"
                type="button"
                onPointerEnter={() => arabicNavItems.forEach((item) => prefetchViewModule(item.view))}
                className={cn(
                  "tvtime-primary-nav-item inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
                  activeIn(view, arabicNavItems) ? "bg-emerald-500/12 text-emerald-400" : "text-foreground/65 hover:bg-accent/80 hover:text-foreground",
                )}
              >
                <Languages className="h-4 w-4" /> Arabic <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Arabic world</DropdownMenuLabel>
              {arabicNavItems.map((item) => (
                <DropdownMenuItem key={item.view} onSelect={() => goTo(item.view)} onFocus={() => prefetchViewModule(item.view)} className={cn("gap-2.5 rounded-lg py-2", view === item.view && "bg-accent text-accent-foreground")}>
                  <item.icon className="h-4 w-4" /> {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <form onSubmit={onSubmitSearch} className="tvtime-header-search ml-auto hidden min-w-0 max-w-[280px] flex-1 md:block lg:max-w-[340px] 2xl:max-w-sm">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              ref={desktopSearchInputRef}
              value={searchVal}
              onChange={(event) => setSearchVal(event.target.value)}
              onFocus={() => prefetchViewModule("search")}
              placeholder="Search titles, people..."
              aria-label="Search movies, shows, anime and people"
              className="h-10 rounded-xl border-border/60 bg-muted/45 pl-9 pr-10 shadow-inner shadow-black/5 transition-[background-color,border-color,box-shadow] duration-200 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/35"
            />
            {searchVal ? (
              <button data-ui-action="icon" type="button" onClick={() => setSearchVal("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">/</kbd>
            )}
          </div>
        </form>

        <span className="hidden max-w-28 truncate text-xs font-semibold text-muted-foreground sm:block md:hidden">{currentLabel}</span>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setMobileSearchOpen((open) => !open);
            prefetchViewModule("search");
            window.requestAnimationFrame(() => mobileSearchInputRef.current?.focus());
          }}
          className="h-10 w-10 rounded-xl md:hidden"
          aria-label="Open search"
        >
          <Search className="h-5 w-5" />
        </Button>

        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative h-10 w-10 rounded-xl">
                <Bell className="h-5 w-5" />
                {notifUnread > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-background">
                    {notifUnread > 9 ? "9+" : notifUnread}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifications</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme" className="hidden h-10 w-10 rounded-xl sm:inline-flex">
                {mounted && resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" className="hidden h-10 w-10 rounded-xl 2xl:inline-flex">
                <Keyboard className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <button data-ui-action="profile" type="button" onClick={() => setProfileOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label="Open profile">
          <Avatar className="h-9 w-9 border border-primary/40 shadow-sm shadow-primary/15">
            <AvatarFallback className="bg-gradient-to-br from-primary/25 to-fuchsia-500/15 text-xs font-black text-primary">
              {userName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-24 pr-1 text-left 2xl:block">
            <span className="block truncate text-xs font-bold">{userName}</span>
            <span className="block text-[9px] text-muted-foreground">View profile</span>
          </span>
        </button>
      </div>

      {mobileSearchOpen && (
        <form onSubmit={onSubmitSearch} className="border-t border-border/50 px-3 py-2 md:hidden">
          <div className="relative mx-auto max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              ref={mobileSearchInputRef}
              value={searchVal}
              onChange={(event) => setSearchVal(event.target.value)}
              placeholder="Search movies, shows, anime and people..."
              aria-label="Search movies, shows, anime and people"
              className="h-11 rounded-xl bg-muted/50 pl-9 pr-10"
              autoFocus
            />
            <button data-ui-action="icon" type="button" onClick={() => { setSearchVal(""); setMobileSearchOpen(false); }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Close search">
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {profileOpen && <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />}
      {helpOpen && <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />}
      {notifOpen && (
        <NotificationCenter
          onClose={() => setNotifOpen(false)}
          onUnreadCountChange={syncUnreadCount}
        />
      )}
    </header>
  );
}

function BrandMark() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary via-rose-500 to-fuchsia-600 text-white shadow-lg shadow-primary/20 transition-[box-shadow,filter] duration-200 group-hover:brightness-105">
      <Play className="h-4 w-4 translate-x-px fill-current" />
      <span className="absolute inset-x-1.5 top-1 h-px bg-white/45" />
    </span>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
