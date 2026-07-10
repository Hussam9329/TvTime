"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ViewName =
  | "home"
  | "discover"
  | "search"
  | "movie-detail"
  | "tv-detail"
  | "person-detail"
  | "calendar"
  | "movies"
  | "anime"
  | "stats"
  | "media"
  | "tv-shows";

export type DiscoverTab = "movies" | "tv";

interface NavState {
  view: ViewName;
  // detail params
  movieId: number | null;
  tvId: number | null;
  personId: number | null;
  // tabs
  discoverTab: DiscoverTab;
  discoverGenre: number | null;
  // search
  searchQuery: string;
  // navigation history for back button
  history: ViewName[];
  // user id (persisted)
  userId: string;
  userName: string;

  setView: (v: ViewName) => void;
  goMovie: (id: number) => void;
  goTv: (id: number) => void;
  goPerson: (id: number) => void;
  back: () => void;
  setDiscoverTab: (t: DiscoverTab) => void;
  setDiscoverGenre: (g: number | null) => void;
  setSearchQuery: (q: string) => void;
  setUserName: (n: string) => void;
  ensureUserId: () => void;
}

function genId() {
  return "u_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

export const useNav = create<NavState>()(
  persist(
    (set, get) => ({
      view: "home",
      movieId: null,
      tvId: null,
      personId: null,
      discoverTab: "movies",
      discoverGenre: null,
      searchQuery: "",
      history: [],
      userId: "",
      userName: "Cinephile",

      setView: (v) =>
        set((s) => ({
          view: v,
          history: [...s.history, s.view].slice(-20),
          // reset transient state when leaving detail
          ...(v !== "movie-detail" ? {} : {}),
        })),

      goMovie: (id) =>
        set((s) => ({
          view: "movie-detail",
          movieId: id,
          history: [...s.history, s.view].slice(-20),
        })),

      goTv: (id) =>
        set((s) => ({
          view: "tv-detail",
          tvId: id,
          history: [...s.history, s.view].slice(-20),
        })),

      goPerson: (id) =>
        set((s) => ({
          view: "person-detail",
          personId: id,
          history: [...s.history, s.view].slice(-20),
        })),

      back: () =>
        set((s) => {
          if (s.history.length === 0) return { view: "home" };
          const history = [...s.history];
          const prev = history.pop()!;
          return { view: prev, history };
        }),

      setDiscoverTab: (t) => set({ discoverTab: t, discoverGenre: null }),
      setDiscoverGenre: (g) => set({ discoverGenre: g }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setUserName: (n) => set({ userName: n }),
      ensureUserId: () =>
        set((s) => (s.userId ? {} : { userId: genId() })),
    }),
    {
      name: "cinetrack-nav",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ userId: s.userId, userName: s.userName }),
    }
  )
);
