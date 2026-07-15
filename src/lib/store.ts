"use client";

import { create } from "zustand";
import type {
  MediaItem,
  MediaStatus,
  MediaType,
  SearchFilters,
  WatchSession,
  Notification,
  CustomList,
} from "./types";
import { allMedia, watchSessions, notifications as initialNotifications, customLists as initialCustomLists } from "./mock-data";

export type ViewKey =
  | "home"
  | "movies"
  | "tvshows"
  | "anime"
  | "arabic_movies"
  | "arabic_tv"
  | "search"
  | "stats"
  | "diary"
  | "lists";

interface AppState {
  // Navigation
  currentView: ViewKey;
  setView: (v: ViewKey) => void;

  // Library
  media: MediaItem[];
  updateMediaStatus: (id: string, status: MediaStatus) => void;
  updateMediaRating: (id: string, rating: number) => void;
  toggleFavorite: (id: string) => void;
  markEpisodeWatched: (mediaId: string, season: number, episode: number, watched: boolean) => void;
  toggleNotifyOnNewEpisode: (id: string) => void;

  // Watch sessions (Diary)
  sessions: WatchSession[];
  addSession: (s: WatchSession) => void;
  updateSessionDate: (id: string, watchedAt: string) => void;
  deleteSession: (id: string) => void;
  rewatchMedia: (mediaId: string) => void;

  // Notifications
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Custom Lists
  lists: CustomList[];
  createList: (name: string, description: string, color: string, isPublic: boolean) => string;
  deleteList: (id: string) => void;
  updateList: (id: string, updates: Partial<Pick<CustomList, "name" | "description" | "color" | "isPublic">>) => void;
  addToList: (listId: string, item: { tmdbId: number; mediaType: MediaType; title: string; posterPath?: string }) => void;
  removeFromList: (listId: string, tmdbId: number, mediaType: MediaType) => void;

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

// Default: notify on new episode for currently watching items
const mediaWithDefaults = allMedia.map((m) =>
  m.status === "watching" && (m.mediaType === "tv" || m.mediaType === "anime" || m.mediaType === "arabic_tv")
    ? { ...m, notifyOnNewEpisode: m.notifyOnNewEpisode ?? true }
    : m
);

let listCounter = 100;
let sessionCounter = 10000;
let notificationCounter = 100;

export const useAppStore = create<AppState>((set, get) => ({
  currentView: "home",
  setView: (v) => set({ currentView: v }),

  media: mediaWithDefaults,
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
        const newProgress = watched
          ? Math.min((m.progress || 0) + 1, m.totalEpisodes || 1)
          : Math.max((m.progress || 0) - 1, 0);
        return { ...m, progress: newProgress };
      }),
    })),
  toggleNotifyOnNewEpisode: (id) =>
    set((s) => ({
      media: s.media.map((m) =>
        m.id === id ? { ...m, notifyOnNewEpisode: !m.notifyOnNewEpisode } : m
      ),
    })),

  // Sessions
  sessions: watchSessions,
  addSession: (sess) => set((s) => ({ sessions: [sess, ...s.sessions] })),
  updateSessionDate: (id, watchedAt) =>
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, watchedAt } : sess)),
    })),
  deleteSession: (id) =>
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),
  rewatchMedia: (mediaId) => {
    const state = get();
    const media = state.media.find((m) => m.id === mediaId);
    if (!media) return;
    // Increment rewatchCount on the media
    set((s) => ({
      media: s.media.map((m) =>
        m.id === mediaId ? { ...m, rewatchCount: (m.rewatchCount || 0) + 1 } : m
      ),
      // Add a new session marked as rewatch
      sessions: [
        {
          id: `s-${sessionCounter++}`,
          mediaId,
          mediaType: media.mediaType,
          tmdbId: media.tmdbId,
          title: media.title,
          season: media.currentSeason,
          episode: media.currentEpisode,
          watchedAt: new Date().toISOString(),
          duration: media.runtime || 45,
          rewatch: true,
          rating: media.userRating,
          source: media.providers?.[0] || "Unknown",
        },
        ...state.sessions,
      ],
    }));
  },

  // Notifications
  notifications: initialNotifications,
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  deleteNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clearAllNotifications: () => set({ notifications: [] }),

  // Custom Lists
  lists: initialCustomLists,
  createList: (name, description, color, isPublic) => {
    const id = `cl-${listCounter++}`;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF]+/g, "-")
      .replace(/^-+|-+$/g, "") + "-" + Date.now().toString(36);
    const newList: CustomList = {
      id,
      name,
      description,
      color,
      isPublic,
      slug,
      items: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ lists: [newList, ...s.lists] }));
    return id;
  },
  deleteList: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
  updateList: (id, updates) =>
    set((s) => ({
      lists: s.lists.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  addToList: (listId, item) =>
    set((s) => ({
      lists: s.lists.map((l) => {
        if (l.id !== listId) return l;
        if (l.items.some((i) => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType)) return l;
        return {
          ...l,
          items: [
            ...l.items,
            {
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              title: item.title,
              posterPath: item.posterPath,
              addedAt: new Date().toISOString(),
            },
          ],
        };
      }),
    })),
  removeFromList: (listId, tmdbId, mediaType) =>
    set((s) => ({
      lists: s.lists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.filter((i) => !(i.tmdbId === tmdbId && i.mediaType === mediaType)) }
          : l
      ),
    })),

  searchFilters: defaultSearchFilters,
  setSearchFilters: (f) => set((s) => ({ searchFilters: { ...s.searchFilters, ...f } })),
  resetSearchFilters: () => set({ searchFilters: defaultSearchFilters }),

  theme: "dark",
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));
