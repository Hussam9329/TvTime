"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNav } from "@/lib/store";
import type { MediaItem, MovieDetail, TvDetail, PaginatedResponse, SeasonDetail, Genre } from "@/lib/tmdb";

// ---------- TMDB fetchers ----------
async function tmdbGet<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL("/api/tmdb/" + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// Home / Trending
export function useTrending(window: "day" | "week" = "week", type: "all" | "movie" | "tv" = "all") {
  return useQuery({
    queryKey: ["tmdb", "trending", window, type],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("trending", { window, type }),
  });
}

export function usePopularMovies(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "movies", "popular", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("movies/popular", { page }),
  });
}

export function useTopRatedMovies(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "movies", "top-rated", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("movies/top-rated", { page }),
  });
}

export function useNowPlayingMovies(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "movies", "now-playing", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("movies/now-playing", { page }),
  });
}

export function useUpcomingMovies(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "movies", "upcoming", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("movies/upcoming", { page }),
  });
}

export function usePopularTv(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "tv", "popular", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("tv/popular", { page }),
  });
}

export function useTopRatedTv(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "tv", "top-rated", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("tv/top-rated", { page }),
  });
}

export function useOnTheAirTv(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "tv", "on-the-air", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("tv/on-the-air", { page }),
  });
}

export function useAiringTodayTv(page = 1) {
  return useQuery({
    queryKey: ["tmdb", "tv", "airing-today", page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("tv/airing-today", { page }),
  });
}

export function useMovieGenres() {
  return useQuery({
    queryKey: ["tmdb", "movies", "genres"],
    queryFn: async () => (await tmdbGet<{ genres: Genre[] }>("movies/genres")).genres,
    staleTime: Infinity,
  });
}

export function useTvGenres() {
  return useQuery({
    queryKey: ["tmdb", "tv", "genres"],
    queryFn: async () => (await tmdbGet<{ genres: Genre[] }>("tv/genres")).genres,
    staleTime: Infinity,
  });
}

export function useDiscoverMovies(params: { genre?: number | null; year?: number; sort_by?: string; page?: number; rating?: number }) {
  return useQuery({
    queryKey: ["tmdb", "movies", "discover", params],
    queryFn: () =>
      tmdbGet<PaginatedResponse<MediaItem>>("movies/discover", {
        ...(params.genre ? { genre: params.genre } : {}),
        ...(params.year ? { year: params.year } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
        page: params.page || 1,
        ...(params.rating ? { rating: params.rating } : {}),
      }),
  });
}

export function useDiscoverTv(params: { genre?: number | null; year?: number; sort_by?: string; page?: number; rating?: number }) {
  return useQuery({
    queryKey: ["tmdb", "tv", "discover", params],
    queryFn: () =>
      tmdbGet<PaginatedResponse<MediaItem>>("tv/discover", {
        ...(params.genre ? { genre: params.genre } : {}),
        ...(params.year ? { year: params.year } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
        page: params.page || 1,
        ...(params.rating ? { rating: params.rating } : {}),
      }),
  });
}

export function useSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ["tmdb", "search", query, page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("search", { q: query, page }),
    enabled: query.trim().length > 0,
  });
}

export function useMovieDetail(id: number | null) {
  return useQuery({
    queryKey: ["tmdb", "movie", id],
    queryFn: () => tmdbGet<MovieDetail>(`movie/${id}`),
    enabled: id != null,
  });
}

export function useTvDetail(id: number | null) {
  return useQuery({
    queryKey: ["tmdb", "tv", id],
    queryFn: () => tmdbGet<TvDetail>(`tv/${id}`),
    enabled: id != null,
  });
}

export function useSeasonDetail(tvId: number | null, seasonNumber: number | null) {
  return useQuery({
    queryKey: ["tmdb", "tv", tvId, "season", seasonNumber],
    queryFn: () => tmdbGet<SeasonDetail>(`tv/${tvId}/season/${seasonNumber}`),
    enabled: tvId != null && seasonNumber != null,
  });
}

export function usePersonDetail(id: number | null) {
  return useQuery({
    queryKey: ["tmdb", "person", id],
    queryFn: () => tmdbGet<any>(`person/${id}`),
    enabled: id != null,
  });
}

// ---------- Library (Neon PostgreSQL backend) ----------
// All tracking actions write directly to the Neon database via API routes.
// This unifies the Home/Discover browsing with the Library view.

// Re-export types for backwards compatibility
export type WatchlistItemDB = MediaItemDB;
export type WatchedMovieDB = MediaItemDB;
export type WatchedEpisodeDB = import("@/lib/local-storage").WatchedEpisode;
export type FollowingShowDB = MediaItemDB;
export type RatingDB = MediaItemDB;

// Episode tracking stays in localStorage (no episode model in DB)
import { libStorage } from "@/lib/local-storage";

// Helper: find-or-create a Media item from TMDB data
async function findOrCreateMedia(args: {
  tmdbId: number;
  title: string;
  type: "movie" | "tv";
  poster?: string | null;
  year?: string;
  overview?: string;
  rating?: number;
  runtime?: number | null;
  genres?: string[];
}): Promise<string> {
  const posterUrl = args.poster
    ? (args.poster.startsWith("http")
      ? args.poster
      : `https://image.tmdb.org/t/p/w500${args.poster}`)
    : null;
  const res = await fetch("/api/media/find-or-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tmdbId: args.tmdbId,
      title: args.title,
      type: args.type === "tv" ? "series" : "movie",
      poster: posterUrl,
      year: args.year,
      overview: args.overview,
      rating: args.rating,
      runtime: args.runtime,
      genres: args.genres,
    }),
  });
  if (!res.ok) throw new Error("Failed to find-or-create media");
  const data = await res.json();
  return data.item.id;
}

// Watchlist - reads from Neon (status="planned", userRating=null)
export function useWatchlist(mediaType?: "movie" | "tv") {
  const type = mediaType === "tv" ? "series" : mediaType || undefined;
  return useQuery({
    queryKey: ["media", "watchlist", type],
    queryFn: async () => {
      const params: any = { status: "planned", rated: "false" };
      if (type) params.type = type;
      const url = new URL("/api/media", window.location.origin);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      const res = await fetch(url);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: data.items || [] };
    },
    staleTime: 0,
  });
}

export function useWatchlistToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      action: "add" | "remove";
      mediaType: "movie" | "tv";
      tmdbId: number;
      title: string;
      posterPath?: string | null;
      backdropPath?: string | null;
      overview?: string;
      releaseDate?: string;
      voteAverage?: number;
      runtime?: number | null;
    }) => {
      if (args.action === "add") {
        // Find-or-create, then set status to "planned"
        const id = await findOrCreateMedia({
          tmdbId: args.tmdbId,
          title: args.title,
          type: args.mediaType,
          poster: args.posterPath,
          year: args.releaseDate ? args.releaseDate.slice(0, 4) : undefined,
          overview: args.overview,
          rating: args.voteAverage,
          runtime: args.runtime,
        });
        await fetch(`/api/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "planned", watched: false, userRating: null, watchedAt: null }),
        });
      } else {
        // Remove from watchlist: find by tmdbId and clear status
        const url = new URL("/api/media", window.location.origin);
        url.searchParams.set("type", args.mediaType === "tv" ? "series" : "movie");
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
          if (item) {
            await fetch(`/api/media/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: null, watched: false, userRating: null, watchedAt: null }),
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Watched Movies - reads from Neon (userRating != null)
export function useWatchedMovies() {
  return useQuery({
    queryKey: ["media", "watched-movies"],
    queryFn: async () => {
      const url = new URL("/api/media", window.location.origin);
      url.searchParams.set("type", "movie");
      url.searchParams.set("rated", "true");
      const res = await fetch(url);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: data.items || [] };
    },
    staleTime: 0,
  });
}

export function useWatchedMovieToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      action: "add" | "remove";
      tmdbId: number;
      title: string;
      posterPath?: string | null;
      runtime?: number | null;
      releaseDate?: string;
      voteAverage?: number;
      overview?: string;
    }) => {
      if (args.action === "add") {
        // Find-or-create, then mark as watched (without rating - will be rated via rating dialog)
        const id = await findOrCreateMedia({
          tmdbId: args.tmdbId,
          title: args.title,
          type: "movie",
          poster: args.posterPath,
          year: args.releaseDate ? args.releaseDate.slice(0, 4) : undefined,
          overview: args.overview,
          rating: args.voteAverage,
          runtime: args.runtime,
        });
        await fetch(`/api/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watched: true, watchedAt: new Date().toISOString(), status: "watched" }),
        });
      } else {
        // Remove from watched: clear rating and watched status
        const url = new URL("/api/media", window.location.origin);
        url.searchParams.set("type", "movie");
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
          if (item) {
            await fetch(`/api/media/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ watched: false, userRating: null, watchedAt: null, status: null }),
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Watched Episodes - stays in localStorage (episode-level tracking)
export function useWatchedEpisodes(showId?: number) {
  return useQuery({
    queryKey: ["lib", "watched-episodes", showId],
    queryFn: () => ({ items: libStorage.getWatchedEpisodes(showId) as any[] }),
    staleTime: 0,
  });
}

export function useEpisodeToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      action: "add" | "remove";
      showId: number;
      seasonNumber: number;
      episodeNumber: number;
      episodeName?: string;
    }) => {
      if (args.action === "add") {
        return libStorage.addWatchedEpisode({
          showId: args.showId,
          seasonNumber: args.seasonNumber,
          episodeNumber: args.episodeNumber,
          episodeName: args.episodeName,
        });
      } else {
        return libStorage.removeWatchedEpisode(args.showId, args.seasonNumber, args.episodeNumber);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes"] });
    },
  });
}

export function useBulkEpisodeToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      showId: number;
      episodes: { seasonNumber: number; episodeNumber: number; episodeName?: string }[];
    }) => {
      return libStorage.addWatchedEpisodesBulk(args.showId, args.episodes);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes"] });
    },
  });
}

// Following - reads from Neon (type="series", status="planned", isAnime=false)
export function useFollowing() {
  return useQuery({
    queryKey: ["media", "following"],
    queryFn: async () => {
      const url = new URL("/api/media", window.location.origin);
      url.searchParams.set("type", "series");
      url.searchParams.set("isAnime", "false");
      url.searchParams.set("status", "planned");
      url.searchParams.set("rated", "false");
      const res = await fetch(url);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: data.items || [] };
    },
    staleTime: 0,
  });
}

export function useFollowingToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "add" | "remove"; tmdbId: number; title: string; posterPath?: string | null; releaseDate?: string; overview?: string; voteAverage?: number }) => {
      if (args.action === "add") {
        const id = await findOrCreateMedia({
          tmdbId: args.tmdbId,
          title: args.title,
          type: "tv",
          poster: args.posterPath,
          year: args.releaseDate ? args.releaseDate.slice(0, 4) : undefined,
          overview: args.overview,
          rating: args.voteAverage,
        });
        await fetch(`/api/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "planned", watched: false, userRating: null }),
        });
      } else {
        const url = new URL("/api/media", window.location.origin);
        url.searchParams.set("type", "series");
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
          if (item) {
            await fetch(`/api/media/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: null, watched: false, userRating: null }),
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Ratings - reads from Neon (userRating != null)
export function useRatings(mediaType?: "movie" | "tv") {
  const type = mediaType === "tv" ? "series" : mediaType || undefined;
  return useQuery({
    queryKey: ["media", "ratings", type],
    queryFn: async () => {
      const url = new URL("/api/media", window.location.origin);
      url.searchParams.set("rated", "true");
      if (type) url.searchParams.set("type", type);
      const res = await fetch(url);
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: data.items || [] };
    },
    staleTime: 0,
  });
}

export function useRatingMutate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "set" | "remove"; mediaType: "movie" | "tv"; tmdbId: number; value?: number; title?: string; posterPath?: string | null; releaseDate?: string; overview?: string; voteAverage?: number; runtime?: number | null }) => {
      if (args.action === "set") {
        // Find-or-create, then set rating + watched
        const id = await findOrCreateMedia({
          tmdbId: args.tmdbId,
          title: args.title || "Unknown",
          type: args.mediaType,
          poster: args.posterPath,
          year: args.releaseDate ? args.releaseDate.slice(0, 4) : undefined,
          overview: args.overview,
          rating: args.voteAverage,
          runtime: args.runtime,
        });
        await fetch(`/api/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userRating: args.value,
            watched: true,
            watchedAt: new Date().toISOString(),
            status: "watched",
          }),
        });
      } else {
        // Remove rating: find by tmdbId and clear
        const url = new URL("/api/media", window.location.origin);
        url.searchParams.set("type", args.mediaType === "tv" ? "series" : "movie");
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
          if (item) {
            await fetch(`/api/media/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userRating: null, watched: false, watchedAt: null, status: null }),
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Stats - reads from Neon
export function useStats() {
  return useQuery({
    queryKey: ["media", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/media/stats");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 0,
  });
}

// ---------- Media (Neon PostgreSQL backend) ----------
export interface MediaItemDB {
  id: string;
  title: string;
  originalTitle: string | null;
  year: string | null;
  type: string;
  poster: string | null;
  rating: string | null;
  overview: string | null;
  genres: string[];
  episodes: number | null;
  seasons: number | null;
  duration: string | null;
  status: string | null;
  author: string | null;
  pages: number | null;
  tags: string[];
  notes: string | null;
  watched: boolean;
  watchedAt: string | null;
  userRating: number | null;
  rewatch: boolean;
  runtime: number | null;
  ratingStatus: string | null;
  addedAt: string;
  updatedAt: string;
}

export interface MediaStats {
  counts: {
    total: number;
    movies: number;
    series: number;
    books: number;
    games: number;
    rated: number;
    watched: number;
    planned: number;
  };
  ratingDist: { value: number; count: number }[];
  typeDist: { type: string; count: number }[];
  topRated: { id: string; title: string; poster: string | null; userRating: number | null; type: string; year: string | null }[];
  recentlyAdded: { id: string; title: string; poster: string | null; type: string; year: string | null; addedAt: string }[];
  avgRating: number;
}

async function mediaGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL("/api/media/" + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== undefined && String(v) !== "undefined" && String(v) !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Media API ${res.status}`);
  return res.json();
}

export function useMedia(params: {
  type?: string;
  status?: string;
  watched?: string;
  rated?: string;
  search?: string;
  sortBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["media", "list", params],
    queryFn: () => mediaGet<{ items: MediaItemDB[]; total: number; limit: number; offset: number }>("", params),
  });
}

export function useMediaStats() {
  return useQuery({
    queryKey: ["media", "stats"],
    queryFn: () => mediaGet<MediaStats>("stats"),
  });
}

// Update media item (rate, mark watched, toggle anime)
export function useMediaUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      userRating?: number | null;
      watched?: boolean;
      watchedAt?: string | null;
      isAnime?: boolean;
      status?: string | null;
    }) => {
      const res = await fetch(`/api/media/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
    },
  });
}
