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
  Compass,
  Film,
  Home,
  Keyboard,
  Languages,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_NAME } from "@/lib/brand";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";
import { TVTIME_SEARCH_CLOSE_EVENT, TVTIME_SEARCH_FOCUS_EVENT } from "@/lib/search-command";
import { useNav, type ViewName } from "@/lib/store";
import { PRIMARY_NAV_VIEWS, SECONDARY_NAV_VIEWS, isDetailView } from "@/lib/navigation-layout";
import { cn } from "@/lib/utils";
import { getViewLabel } from "@/lib/view-metadata";
import { prefetchViewModule } from "@/lib/view-prefetch";

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

type NavItem = { view: ViewName; icon: React.ElementType };

const navigationIcons: Partial<Record<ViewName, React.ElementType>> = {
  home: Home,
  "watch-next": Play,
  discover: Compass,
  movies: Film,
  "tv-shows": Clapperboard,
  anime: Sparkles,
  stats: BarChart3,
  "arabic-movies": Languages,
  "arabic-tv": Clapperboard,
};

const toNavItem = (view: ViewName): NavItem => ({
  view,
  icon: navigationIcons[view] ?? Film,
});

const primaryNavItems = PRIMARY_NAV_VIEWS.map(toNavItem);
const secondaryNavItems = SECONDARY_NAV_VIEWS.map(toNavItem);

const NOTIFICATION_QUERY_KEY = ["notifications", "unread-count", getClientUserId()] as const;

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

  const currentLabel = getViewLabel(view);
  const detailView = isDetailView(view);
  const secondaryActive = secondaryNavItems.some((item) => item.view === view);

  const navButton = (item: NavItem, compact = false) => {
    const active = item.view === view;
    const label = getViewLabel(item.view);

    return (
      <button
        data-ui-action="nav"
        data-active={active ? "true" : "false"}
        key={item.view}
        type="button"
        onClick={() => goTo(item.view)}
        onPointerEnter={() => prefetchViewModule(item.view)}
        onFocus={() => prefetchViewModule(item.view)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative inline-flex items-center font-semibold transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/65",
          compact
            ? "w-full gap-3 rounded-xl px-3 py-2.5 text-sm"
            : "tvtime-primary-nav-item gap-2 rounded-xl px-3 py-2 text-[13px]",
          active
            ? "bg-primary/12 text-foreground shadow-sm"
            : "text-foreground/62 hover:bg-accent/70 hover:text-foreground",
        )}
      >
        <item.icon className={cn("shrink-0 transition-colors", compact ? "h-[18px] w-[18px]" : "h-4 w-4", active && "text-primary")} />
        <span>{label}</span>
        {!compact && active && <span className="tvtime-nav-active-indicator" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <header
      className="tvtime-app-header sticky top-0 z-40"
      data-mobile-search-open={mobileSearchOpen ? "true" : "false"}
    >
      <div className="tvtime-header-inner mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:h-[72px] sm:px-4 lg:px-5">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="tvtime-header-icon h-10 w-10 xl:hidden"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="tvtime-navigation-sheet w-[min(88vw,360px)] border-r-border/70 p-0">
            <SheetHeader className="border-b border-border/60 p-5 text-left">
              <SheetTitle className="flex items-center gap-3">
                <BrandMark />
                <span>
                  <span className="block text-lg font-black tracking-tight">{APP_NAME}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your watch universe</span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex max-h-[calc(100dvh-88px)] flex-col gap-5 overflow-y-auto p-4" aria-label="Mobile navigation">
              <NavGroup label="Explore">{primaryNavItems.map((item) => navButton(item, true))}</NavGroup>
              <NavGroup label="Library & worlds">{secondaryNavItems.map((item) => navButton(item, true))}</NavGroup>
            </nav>
          </SheetContent>
        </Sheet>

        {detailView && historyLength > 0 && (
          <Button variant="ghost" size="icon" onClick={back} className="tvtime-header-icon h-10 w-10" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <button
          data-ui-action="brand"
          type="button"
          onClick={() => goTo("home")}
          onPointerEnter={() => prefetchViewModule("home")}
          className="group flex shrink-0 items-center gap-2.5 rounded-xl pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={`${APP_NAME} home`}
        >
          <BrandMark />
          <span className="tvtime-brand-copy hidden sm:block">
            <span className="block text-lg font-black leading-none tracking-[-0.045em]">{APP_NAME}</span>
            <span className="tvtime-brand-tagline mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Watch. Track. Remember.</span>
          </span>
        </button>

        <nav className="tvtime-primary-nav ml-2 hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
          {primaryNavItems.map((item) => navButton(item))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-ui-action="nav-more"
                data-active={secondaryActive ? "true" : "false"}
                aria-current={secondaryActive ? "page" : undefined}
                className={cn(
                  "tvtime-primary-nav-item group relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/65",
                  secondaryActive
                    ? "bg-primary/12 text-foreground shadow-sm"
                    : "text-foreground/62 hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <MoreHorizontal className={cn("h-4 w-4", secondaryActive && "text-primary")} />
                <span>More</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-65" />
                {secondaryActive && <span className="tvtime-nav-active-indicator" aria-hidden="true" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="w-60">
              <DropdownMenuLabel>More destinations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {secondaryNavItems.map((item) => {
                const label = getViewLabel(item.view);
                return (
                  <DropdownMenuItem
                    key={item.view}
                    className="gap-3 py-2.5"
                    onFocus={() => prefetchViewModule(item.view)}
                    onSelect={() => goTo(item.view)}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {item.view === "stats" ? "Insights from your viewing history" : "Browse a dedicated Arabic catalogue"}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <form onSubmit={onSubmitSearch} className="tvtime-header-search ml-auto hidden min-w-0 max-w-[300px] flex-1 md:block 2xl:max-w-[360px]">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              ref={desktopSearchInputRef}
              value={searchVal}
              onChange={(event) => setSearchVal(event.target.value)}
              onFocus={() => prefetchViewModule("search")}
              placeholder="Search titles, people..."
              aria-label="Search movies, shows, anime and people"
              className="tvtime-command-search h-11 rounded-xl border-border/70 bg-muted/35 pl-10 pr-10"
            />
            {searchVal ? (
              <button
                data-ui-action="icon"
                type="button"
                onClick={() => setSearchVal("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
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
            const nextOpen = !mobileSearchOpen;
            setMobileSearchOpen(nextOpen);
            if (nextOpen) {
              prefetchViewModule("search");
              window.requestAnimationFrame(() => mobileSearchInputRef.current?.focus());
            }
          }}
          className="tvtime-header-icon h-10 w-10 md:hidden"
          aria-label={mobileSearchOpen ? "Close search" : "Open search"}
          aria-expanded={mobileSearchOpen}
          aria-controls="tvtime-mobile-search"
        >
          {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>

        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotifOpen(true)}
                aria-label={notifUnread > 0 ? `Notifications, ${notifUnread} unread` : "Notifications"}
                className="tvtime-header-icon relative h-10 w-10"
              >
                <Bell className="h-5 w-5" />
                {notifUnread > 0 && (
                  <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground ring-2 ring-background">
                    {notifUnread > 9 ? "9+" : notifUnread}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifications</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="tvtime-header-icon hidden h-10 w-10 sm:inline-flex"
              >
                {mounted && resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHelpOpen(true)}
                aria-label="Keyboard shortcuts"
                className="tvtime-header-icon hidden h-10 w-10 2xl:inline-flex"
              >
                <Keyboard className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <button
          data-ui-action="profile"
          type="button"
          onClick={() => setProfileOpen(true)}
          className="tvtime-profile-trigger flex shrink-0 items-center gap-2 rounded-xl p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={`Open ${userName} profile`}
        >
          <Avatar className="h-9 w-9 border border-primary/30 shadow-sm">
            <AvatarFallback className="bg-primary/12 text-xs font-black text-primary">
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
        <form id="tvtime-mobile-search" onSubmit={onSubmitSearch} className="tvtime-mobile-search-panel px-3 pb-2.5 pt-1 md:hidden">
          <div className="relative mx-auto max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              ref={mobileSearchInputRef}
              value={searchVal}
              onChange={(event) => setSearchVal(event.target.value)}
              placeholder="Search movies, shows, anime and people..."
              aria-label="Search movies, shows, anime and people"
              className="h-11 rounded-xl bg-card pl-10 pr-11"
            />
            <button
              data-ui-action="icon"
              type="button"
              onClick={() => {
                setSearchVal("");
                setMobileSearchOpen(false);
              }}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="Close search"
            >
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
    <span className="tvtime-brand-mark relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-[box-shadow,filter,transform] duration-200 group-hover:brightness-105 sm:h-11 sm:w-11">
      <span className="absolute inset-1 rounded-[10px] border border-white/18" aria-hidden="true" />
      <Play className="h-4 w-4 translate-x-px fill-current" />
      <span className="absolute inset-x-2 top-1.5 h-px bg-white/45" aria-hidden="true" />
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
