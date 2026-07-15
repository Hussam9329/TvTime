"use client";

import { create } from "zustand";
import type { MediaItem, MediaStatus, MediaType, SearchFilters } from "./types";
import { allMedia } from "./mock-data";

export type ViewKey =
  | "home"
  | "movies"
  | "tvshows"
  | "anime"
  | "arabic_movies"
  | "arabic_tv"
  | "search"
  | "stats";

interface AppState {
  // Navigation
  currentView: ViewKey;
  setView: (v: ViewKey) => void;

  // Library (data lives in store so updates reflect everywhere)
  media: MediaItem[];
  updateMediaStatus: (id: string, status: MediaStatus) => void;
  updateMediaRating: (id: string, rating: number) => void;
  toggleFavorite: (id: string) => void;
  markEpisodeWatched: (mediaId: string, season: number, episode: number, watched: boolean) => void;

  // Search filters
  searchFilters: SearchFilters;
  setSearchFilters: (f: Partial<SearchFilters>) => void;
  resetSearchFilters: () => void;

  // Theme
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const defaultSearchFilters: SearchFilters = {
  query: "",
  types: ["movie", "tv", "anime", "arabic_movie", "arabic_tv"],
  genres: [],
  sortBy: "relevance",
};

export const useAppStore = create<AppState>((set, get) => ({
  currentView: "home",
  setView: (v) => set({ currentView: v }),

  media: allMedia,
  updateMediaStatus: (id, status) =>
    set((s) => ({
      media: s.media.map((m) => (m.id === id ? { ...m, status } : m)),
    })),
  updateMediaRating: (id, rating) =>
    set((s) => ({
      media: s.media.map((m) => (m.id === id ? { ...m, userRating: rating } : m)),
    })),
  toggleFavorite: (id) =>
    set((s) => ({
      media: s.media.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)),
    })),
  markEpisodeWatched: (mediaId, season, episode, watched) =>
    set((s) => ({
      media: s.media.map((m) => {
        if (m.id !== mediaId) return m;
        // For demo, increment progress
        const newProgress = watched ? Math.min((m.progress || 0) + 1, m.totalEpisodes || 1) : Math.max((m.progress || 0) - 1, 0);
        return { ...m, progress: newProgress };
      }),
    })),

  searchFilters: defaultSearchFilters,
  setSearchFilters: (f) => set((s) => ({ searchFilters: { ...s.searchFilters, ...f } })),
  resetSearchFilters: () => set({ searchFilters: defaultSearchFilters }),

  theme: "dark",
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));
