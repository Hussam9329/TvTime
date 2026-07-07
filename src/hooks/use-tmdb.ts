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

// ---------- Library ----------
export interface WatchlistItemDB {
  id: string;
  userId: string;
  mediaType: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  addedAt: string;
}
export interface WatchedMovieDB {
  id: string;
  userId: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  runtime: number | null;
  watchedAt: string;
}
export interface WatchedEpisodeDB {
  id: string;
  userId: string;
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  watchedAt: string;
}
export interface FollowingShowDB {
  id: string;
  userId: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  followedAt: string;
}
export interface RatingDB {
  id: string;
  userId: string;
  mediaType: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  value: number;
  createdAt: string;
  updatedAt: string;
}

function useUserId() {
  return useNav((s) => s.userId);
}

function libGet<T>(path: string, userId: string, params?: Record<string, string>) {
  const url = new URL("/api/library/" + path, window.location.origin);
  url.searchParams.set("userId", userId);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString()).then((r) => r.json()) as Promise<T>;
}

async function libPost(path: string, userId: string, body: unknown) {
  const res = await fetch(`/api/library/${path}?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function libDelete(path: string, userId: string, params: Record<string, string>) {
  const url = new URL(`/api/library/${path}`, window.location.origin);
  url.searchParams.set("userId", userId);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { method: "DELETE" });
  return res.json();
}

// Watchlist
export function useWatchlist(mediaType?: "movie" | "tv") {
  const userId = useUserId();
  return useQuery({
    queryKey: ["lib", "watchlist", userId, mediaType],
    queryFn: () => libGet<{ items: WatchlistItemDB[] }>("watchlist", userId, mediaType ? { mediaType } : undefined),
    enabled: !!userId,
  });
}

export function useWatchlistToggle() {
  const qc = useQueryClient();
  const userId = useUserId();
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
    }) => {
      if (args.action === "add") {
        return libPost("watchlist", userId, {
          mediaType: args.mediaType,
          tmdbId: args.tmdbId,
          title: args.title,
          posterPath: args.posterPath,
          backdropPath: args.backdropPath,
          overview: args.overview,
          releaseDate: args.releaseDate,
          voteAverage: args.voteAverage,
        });
      } else {
        return libDelete("watchlist", userId, { mediaType: args.mediaType, tmdbId: String(args.tmdbId) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watchlist", userId] });
      qc.invalidateQueries({ queryKey: ["lib", "stats", userId] });
    },
  });
}

// Watched Movies
export function useWatchedMovies() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["lib", "watched-movies", userId],
    queryFn: () => libGet<{ items: WatchedMovieDB[] }>("watched-movies", userId),
    enabled: !!userId,
  });
}

export function useWatchedMovieToggle() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (args: {
      action: "add" | "remove";
      tmdbId: number;
      title: string;
      posterPath?: string | null;
      runtime?: number | null;
    }) => {
      if (args.action === "add") {
        return libPost("watched-movies", userId, {
          tmdbId: args.tmdbId,
          title: args.title,
          posterPath: args.posterPath,
          runtime: args.runtime,
        });
      } else {
        return libDelete("watched-movies", userId, { tmdbId: String(args.tmdbId) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-movies", userId] });
      qc.invalidateQueries({ queryKey: ["lib", "stats", userId] });
    },
  });
}

// Watched Episodes
export function useWatchedEpisodes(showId?: number) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["lib", "watched-episodes", userId, showId],
    queryFn: () =>
      libGet<{ items: WatchedEpisodeDB[] }>("watched-episodes", userId, showId ? { showId: String(showId) } : undefined),
    enabled: !!userId,
  });
}

export function useEpisodeToggle() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (args: {
      action: "add" | "remove";
      showId: number;
      seasonNumber: number;
      episodeNumber: number;
      episodeName?: string;
    }) => {
      if (args.action === "add") {
        return libPost("watched-episodes", userId, {
          showId: args.showId,
          seasonNumber: args.seasonNumber,
          episodeNumber: args.episodeNumber,
          episodeName: args.episodeName,
        });
      } else {
        return libDelete("watched-episodes", userId, {
          showId: String(args.showId),
          seasonNumber: String(args.seasonNumber),
          episodeNumber: String(args.episodeNumber),
        });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes", userId] });
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes", userId, vars.showId] });
      qc.invalidateQueries({ queryKey: ["lib", "stats", userId] });
    },
  });
}

export function useBulkEpisodeToggle() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (args: {
      showId: number;
      episodes: { seasonNumber: number; episodeNumber: number; episodeName?: string }[];
    }) => {
      return libPost("watched-episodes", userId, { showId: args.showId, episodes: args.episodes });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes", userId] });
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes", userId, vars.showId] });
      qc.invalidateQueries({ queryKey: ["lib", "stats", userId] });
    },
  });
}

// Following
export function useFollowing() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["lib", "following", userId],
    queryFn: () => libGet<{ items: FollowingShowDB[] }>("following", userId),
    enabled: !!userId,
  });
}

export function useFollowingToggle() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (args: { action: "add" | "remove"; tmdbId: number; title: string; posterPath?: string | null }) => {
      if (args.action === "add") {
        return libPost("following", userId, { tmdbId: args.tmdbId, title: args.title, posterPath: args.posterPath });
      } else {
        return libDelete("following", userId, { tmdbId: String(args.tmdbId) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "following", userId] });
      qc.invalidateQueries({ queryKey: ["lib", "stats", userId] });
    },
  });
}

// Ratings
export function useRatings(mediaType?: "movie" | "tv") {
  const userId = useUserId();
  return useQuery({
    queryKey: ["lib", "ratings", userId, mediaType],
    queryFn: () => libGet<{ items: RatingDB[] }>("ratings", userId, mediaType ? { mediaType } : undefined),
    enabled: !!userId,
  });
}

export function useRatingMutate() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (args: { action: "set" | "remove"; mediaType: "movie" | "tv"; tmdbId: number; value?: number; title?: string; posterPath?: string | null }) => {
      if (args.action === "set") {
        return libPost("ratings", userId, {
          mediaType: args.mediaType,
          tmdbId: args.tmdbId,
          value: args.value,
          title: args.title,
          posterPath: args.posterPath,
        });
      } else {
        return libDelete("ratings", userId, { mediaType: args.mediaType, tmdbId: String(args.tmdbId) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "ratings", userId] });
      qc.invalidateQueries({ queryKey: ["lib", "stats", userId] });
    },
  });
}

// Stats
export function useStats() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["lib", "stats", userId],
    queryFn: () => libGet<any>("stats", userId),
    enabled: !!userId,
    staleTime: 5000,
  });
}
