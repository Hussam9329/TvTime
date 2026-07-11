"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  HOME_NAVIGATION_ENTRY,
  navigationEntryFromView,
  navigationEntryToHref,
  normalizeNavigationEntry,
  sameNavigationEntry,
  type NavigationEntry,
  type ViewName,
} from "@/lib/navigation";

export type { NavigationEntry, ViewName } from "@/lib/navigation";
export type DiscoverTab = "movies" | "tv";

type RouteSyncMode = "reset" | "pop";

interface NavState extends NavigationEntry {
  discoverTab: DiscoverTab;
  discoverGenre: number | null;
  searchQuery: string;
  history: NavigationEntry[];
  navigationIndex: number;
  routeReady: boolean;
  userId: string;
  userName: string;

  setView: (v: ViewName) => void;
  goMovie: (id: number) => void;
  goTv: (id: number) => void;
  goPerson: (id: number) => void;
  back: () => void;
  syncRoute: (entry: NavigationEntry, mode: RouteSyncMode, browserIndex?: number) => void;
  setDiscoverTab: (t: DiscoverTab) => void;
  setDiscoverGenre: (g: number | null) => void;
  setSearchQuery: (q: string) => void;
  setUserName: (n: string) => void;
  ensureUserId: () => void;
}

const HISTORY_LIMIT = 30;
const NAV_INDEX_KEY = "__tvTimeNavigationIndex";

function genId() {
  return "u_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function currentEntry(state: Pick<NavState, keyof NavigationEntry>): NavigationEntry {
  return normalizeNavigationEntry({
    view: state.view,
    movieId: state.movieId,
    tvId: state.tvId,
    personId: state.personId,
  });
}

function writeBrowserEntry(entry: NavigationEntry, index: number, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const state = { ...(window.history.state || {}), [NAV_INDEX_KEY]: index };
  const href = navigationEntryToHref(entry);
  if (mode === "replace") window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
}

export function getBrowserNavigationIndex(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const value = Number(window.history.state?.[NAV_INDEX_KEY]);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function initializeBrowserNavigation(entry: NavigationEntry): number {
  const existing = getBrowserNavigationIndex();
  const index = existing ?? 0;
  if (existing == null) writeBrowserEntry(entry, index, "replace");
  return index;
}

export const useNav = create<NavState>()(
  persist(
    (set, get) => {
      const navigate = (entry: NavigationEntry) => {
        const next = normalizeNavigationEntry(entry);
        const state = get();
        const current = currentEntry(state);
        if (sameNavigationEntry(current, next)) return;
        const nextIndex = state.navigationIndex + 1;
        writeBrowserEntry(next, nextIndex, "push");
        set({
          ...next,
          navigationIndex: nextIndex,
          history: [...state.history, current].slice(-HISTORY_LIMIT),
        });
      };

      return {
        ...HOME_NAVIGATION_ENTRY,
        discoverTab: "movies",
        discoverGenre: null,
        searchQuery: "",
        history: [],
        navigationIndex: 0,
        routeReady: false,
        userId: "",
        userName: "Cinephile",

        setView: (view) => navigate(navigationEntryFromView(view)),
        goMovie: (movieId) => navigate({ view: "movie-detail", movieId, tvId: null, personId: null }),
        goTv: (tvId) => navigate({ view: "tv-detail", movieId: null, tvId, personId: null }),
        goPerson: (personId) => navigate({ view: "person-detail", movieId: null, tvId: null, personId }),

        back: () => {
          const state = get();
          if (state.history.length > 0 && typeof window !== "undefined") {
            window.history.back();
            return;
          }
          const home = HOME_NAVIGATION_ENTRY;
          writeBrowserEntry(home, state.navigationIndex, "replace");
          set({ ...home, history: [] });
        },

        syncRoute: (entry, mode, browserIndex) => {
          const next = normalizeNavigationEntry(entry);
          const state = get();
          const targetIndex = Number.isInteger(browserIndex) && Number(browserIndex) >= 0
            ? Number(browserIndex)
            : state.navigationIndex;

          if (mode === "reset") {
            set({ ...next, history: [], navigationIndex: targetIndex, routeReady: true });
            return;
          }

          let history = [...state.history];
          if (targetIndex < state.navigationIndex) {
            const distance = Math.max(1, state.navigationIndex - targetIndex);
            history = history.slice(0, Math.max(0, history.length - distance));
          } else if (targetIndex > state.navigationIndex) {
            history = [...history, currentEntry(state)].slice(-HISTORY_LIMIT);
          } else if (history.length > 0 && sameNavigationEntry(history[history.length - 1], next)) {
            history.pop();
          }

          set({ ...next, history, navigationIndex: targetIndex });
        },

        setDiscoverTab: (discoverTab) => set({ discoverTab, discoverGenre: null }),
        setDiscoverGenre: (discoverGenre) => set({ discoverGenre }),
        setSearchQuery: (searchQuery) => set({ searchQuery }),
        setUserName: (userName) => set({ userName }),
        ensureUserId: () => set((state) => (state.userId ? {} : { userId: genId() })),
      };
    },
    {
      name: "cinetrack-nav",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ userId: state.userId, userName: state.userName }),
    },
  ),
);
