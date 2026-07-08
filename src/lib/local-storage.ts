"use client";

/**
 * localStorage-based storage for library data.
 * Used by the TMDB browsing features (watchlist, following, episode tracking).
 * The main media collection uses Neon PostgreSQL via API routes.
 */

export interface WatchlistItem {
  id: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  addedAt: string;
}

export interface WatchedMovie {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  runtime: number | null;
  watchedAt: string;
}

export interface WatchedEpisode {
  id: string;
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  watchedAt: string;
}

export interface FollowingShow {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  followedAt: string;
}

export interface Rating {
  id: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  value: number;
  createdAt: string;
  updatedAt: string;
}

const PREFIX = "cinetrack_lib_";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("cinetrack-lib-change", { detail: { key } }));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const libStorage = {
  getWatchlist: (mediaType?: "movie" | "tv") => {
    const items = read<WatchlistItem>("watchlist");
    return mediaType ? items.filter((i) => i.mediaType === mediaType) : items;
  },
  addToWatchlist: (item: Omit<WatchlistItem, "id" | "addedAt">) => {
    const items = read<WatchlistItem>("watchlist");
    const existing = items.find((i) => i.mediaType === item.mediaType && i.tmdbId === item.tmdbId);
    if (existing) return existing;
    const newItem: WatchlistItem = { ...item, id: genId(), addedAt: new Date().toISOString() };
    write("watchlist", [...items, newItem]);
    return newItem;
  },
  removeFromWatchlist: (mediaType: "movie" | "tv", tmdbId: number) => {
    const items = read<WatchlistItem>("watchlist");
    write("watchlist", items.filter((i) => !(i.mediaType === mediaType && i.tmdbId === tmdbId)));
  },

  getWatchedMovies: () => read<WatchedMovie>("watched_movies"),
  addWatchedMovie: (item: Omit<WatchedMovie, "id" | "watchedAt">) => {
    const items = read<WatchedMovie>("watched_movies");
    const existing = items.find((i) => i.tmdbId === item.tmdbId);
    if (existing) return existing;
    const newItem: WatchedMovie = { ...item, id: genId(), watchedAt: new Date().toISOString() };
    write("watched_movies", [...items, newItem]);
    return newItem;
  },
  removeWatchedMovie: (tmdbId: number) => {
    const items = read<WatchedMovie>("watched_movies");
    write("watched_movies", items.filter((i) => i.tmdbId !== tmdbId));
  },

  getWatchedEpisodes: (showId?: number) => {
    const items = read<WatchedEpisode>("watched_episodes");
    return showId ? items.filter((i) => i.showId === showId) : items;
  },
  addWatchedEpisode: (item: Omit<WatchedEpisode, "id" | "watchedAt">) => {
    const items = read<WatchedEpisode>("watched_episodes");
    const existing = items.find(
      (i) => i.showId === item.showId && i.seasonNumber === item.seasonNumber && i.episodeNumber === item.episodeNumber
    );
    if (existing) return existing;
    const newItem: WatchedEpisode = { ...item, id: genId(), watchedAt: new Date().toISOString() };
    write("watched_episodes", [...items, newItem]);
    return newItem;
  },
  addWatchedEpisodesBulk: (showId: number, episodes: { seasonNumber: number; episodeNumber: number; episodeName?: string }[]) => {
    const items = read<WatchedEpisode>("watched_episodes");
    const newItems = [...items];
    for (const ep of episodes) {
      const exists = newItems.find(
        (i) => i.showId === showId && i.seasonNumber === ep.seasonNumber && i.episodeNumber === ep.episodeNumber
      );
      if (!exists) {
        newItems.push({
          id: genId(),
          showId,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          episodeName: ep.episodeName || null,
          watchedAt: new Date().toISOString(),
        });
      }
    }
    write("watched_episodes", newItems);
  },
  removeWatchedEpisode: (showId: number, seasonNumber: number, episodeNumber: number) => {
    const items = read<WatchedEpisode>("watched_episodes");
    write(
      "watched_episodes",
      items.filter((i) => !(i.showId === showId && i.seasonNumber === seasonNumber && i.episodeNumber === episodeNumber))
    );
  },

  getFollowing: () => read<FollowingShow>("following"),
  followShow: (item: Omit<FollowingShow, "id" | "followedAt">) => {
    const items = read<FollowingShow>("following");
    const existing = items.find((i) => i.tmdbId === item.tmdbId);
    if (existing) return existing;
    const newItem: FollowingShow = { ...item, id: genId(), followedAt: new Date().toISOString() };
    write("following", [...items, newItem]);
    return newItem;
  },
  unfollowShow: (tmdbId: number) => {
    const items = read<FollowingShow>("following");
    write("following", items.filter((i) => i.tmdbId !== tmdbId));
  },

  getRatings: (mediaType?: "movie" | "tv") => {
    const items = read<Rating>("ratings");
    return mediaType ? items.filter((i) => i.mediaType === mediaType) : items;
  },
  setRating: (item: Omit<Rating, "id" | "createdAt" | "updatedAt">) => {
    const items = read<Rating>("ratings");
    const existing = items.find((i) => i.mediaType === item.mediaType && i.tmdbId === item.tmdbId);
    if (existing) {
      const updated = { ...existing, value: item.value, title: item.title, posterPath: item.posterPath, updatedAt: new Date().toISOString() };
      write("ratings", items.map((i) => (i.id === existing.id ? updated : i)));
      return updated;
    }
    const newItem: Rating = {
      ...item,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    write("ratings", [...items, newItem]);
    return newItem;
  },
  removeRating: (mediaType: "movie" | "tv", tmdbId: number) => {
    const items = read<Rating>("ratings");
    write("ratings", items.filter((i) => !(i.mediaType === mediaType && i.tmdbId === tmdbId)));
  },

  getStats: () => {
    const watchlist = read<WatchlistItem>("watchlist");
    const watchedMovies = read<WatchedMovie>("watched_movies");
    const watchedEpisodes = read<WatchedEpisode>("watched_episodes");
    const following = read<FollowingShow>("following");
    const ratings = read<Rating>("ratings");

    const showsWatched = new Set(watchedEpisodes.map((e) => e.showId));
    const movieMinutes = watchedMovies.reduce((s, m) => s + (m.runtime || 0), 0);
    const episodeMinutes = watchedEpisodes.length * 45;
    const totalMinutes = movieMinutes + episodeMinutes;

    const episodesByShow = new Map<number, number>();
    for (const e of watchedEpisodes) {
      episodesByShow.set(e.showId, (episodesByShow.get(e.showId) || 0) + 1);
    }

    const moviesByMonth = new Map<string, number>();
    for (const m of watchedMovies) {
      const key = m.watchedAt.slice(0, 7);
      moviesByMonth.set(key, (moviesByMonth.get(key) || 0) + 1);
    }
    const episodesByMonth = new Map<string, number>();
    for (const e of watchedEpisodes) {
      const key = e.watchedAt.slice(0, 7);
      episodesByMonth.set(key, (episodesByMonth.get(key) || 0) + 1);
    }

    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.value, 0) / ratings.length : 0;

    const ratingDist = new Map<number, number>();
    for (const r of ratings) {
      ratingDist.set(r.value, (ratingDist.get(r.value) || 0) + 1);
    }

    return {
      user: { name: "Cinephile", createdAt: new Date().toISOString() },
      counts: {
        watchedMovies: watchedMovies.length,
        watchedEpisodes: watchedEpisodes.length,
        showsWatched: showsWatched.size,
        watchlist: watchlist.length,
        watchlistMovies: watchlist.filter((w) => w.mediaType === "movie").length,
        watchlistShows: watchlist.filter((w) => w.mediaType === "tv").length,
        following: following.length,
        ratings: ratings.length,
      },
      watchTime: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60),
        movieMinutes,
        episodeMinutes,
      },
      episodesByShow: Array.from(episodesByShow.entries()).map(([showId, count]) => ({ showId, count })),
      moviesByMonth: Array.from(moviesByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
      episodesByMonth: Array.from(episodesByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
      avgRating,
      ratingDist: Array.from(ratingDist.entries()).sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count })),
    };
  },

  exportAll: () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "CineTrack",
    library: {
      watchlist: read("watchlist"),
      watchedMovies: read("watched_movies"),
      watchedEpisodes: read("watched_episodes"),
      following: read("following"),
      ratings: read("ratings"),
    },
  }),

  importAll: (data: any) => {
    const lib = data?.library;
    if (!lib) return { watchlist: 0, watchedMovies: 0, watchedEpisodes: 0, following: 0, ratings: 0 };
    let imported = { watchlist: 0, watchedMovies: 0, watchedEpisodes: 0, following: 0, ratings: 0 };
    if (Array.isArray(lib.watchlist)) {
      const existing = read<WatchlistItem>("watchlist");
      for (const item of lib.watchlist) {
        if (!existing.find((i) => i.mediaType === item.mediaType && i.tmdbId === item.tmdbId)) {
          existing.push(item);
          imported.watchlist++;
        }
      }
      write("watchlist", existing);
    }
    if (Array.isArray(lib.watchedMovies)) {
      const existing = read<WatchedMovie>("watched_movies");
      for (const item of lib.watchedMovies) {
        if (!existing.find((i) => i.tmdbId === item.tmdbId)) {
          existing.push(item);
          imported.watchedMovies++;
        }
      }
      write("watched_movies", existing);
    }
    if (Array.isArray(lib.watchedEpisodes)) {
      const existing = read<WatchedEpisode>("watched_episodes");
      for (const item of lib.watchedEpisodes) {
        if (!existing.find((i) => i.showId === item.showId && i.seasonNumber === item.seasonNumber && i.episodeNumber === item.episodeNumber)) {
          existing.push(item);
          imported.watchedEpisodes++;
        }
      }
      write("watched_episodes", existing);
    }
    if (Array.isArray(lib.following)) {
      const existing = read<FollowingShow>("following");
      for (const item of lib.following) {
        if (!existing.find((i) => i.tmdbId === item.tmdbId)) {
          existing.push(item);
          imported.following++;
        }
      }
      write("following", existing);
    }
    if (Array.isArray(lib.ratings)) {
      const existing = read<Rating>("ratings");
      for (const item of lib.ratings) {
        if (!existing.find((i) => i.mediaType === item.mediaType && i.tmdbId === item.tmdbId)) {
          existing.push(item);
          imported.ratings++;
        }
      }
      write("ratings", existing);
    }
    return imported;
  },

  clearAll: () => {
    write("watchlist", []);
    write("watched_movies", []);
    write("watched_episodes", []);
    write("following", []);
    write("ratings", []);
  },
};
