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

// ---------- Library (localStorage-based, works on serverless) ----------
// Re-export types from local-storage for backwards compatibility
export type WatchlistItemDB = import("@/lib/local-storage").WatchlistItem;
export type WatchedMovieDB = import("@/lib/local-storage").WatchedMovie;
export type WatchedEpisodeDB = import("@/lib/local-storage").WatchedEpisode;
export type FollowingShowDB = import("@/lib/local-storage").FollowingShow;
export type RatingDB = import("@/lib/local-storage").Rating;

import { libStorage } from "@/lib/local-storage";

// Watchlist
export function useWatchlist(mediaType?: "movie" | "tv") {
  return useQuery({
    queryKey: ["lib", "watchlist", mediaType],
    queryFn: () => ({ items: libStorage.getWatchlist(mediaType) as any[] }),
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
    }) => {
      if (args.action === "add") {
        return libStorage.addToWatchlist({
          mediaType: args.mediaType,
          tmdbId: args.tmdbId,
          title: args.title,
          posterPath: args.posterPath || null,
          backdropPath: args.backdropPath || null,
          overview: args.overview || null,
          releaseDate: args.releaseDate || null,
          voteAverage: args.voteAverage || null,
        });
      } else {
        return libStorage.removeFromWatchlist(args.mediaType, args.tmdbId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Watched Movies
export function useWatchedMovies() {
  return useQuery({
    queryKey: ["lib", "watched-movies"],
    queryFn: () => ({ items: libStorage.getWatchedMovies() as any[] }),
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
    }) => {
      if (args.action === "add") {
        return libStorage.addWatchedMovie({
          tmdbId: args.tmdbId,
          title: args.title,
          posterPath: args.posterPath || null,
          runtime: args.runtime || null,
        });
      } else {
        return libStorage.removeWatchedMovie(args.tmdbId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Watched Episodes
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
      qc.invalidateQueries({ queryKey: ["lib"] });
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
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Following
export function useFollowing() {
  return useQuery({
    queryKey: ["lib", "following"],
    queryFn: () => ({ items: libStorage.getFollowing() as any[] }),
    staleTime: 0,
  });
}

export function useFollowingToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "add" | "remove"; tmdbId: number; title: string; posterPath?: string | null }) => {
      if (args.action === "add") {
        return libStorage.followShow({
          tmdbId: args.tmdbId,
          title: args.title,
          posterPath: args.posterPath || null,
        });
      } else {
        return libStorage.unfollowShow(args.tmdbId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Ratings
export function useRatings(mediaType?: "movie" | "tv") {
  return useQuery({
    queryKey: ["lib", "ratings", mediaType],
    queryFn: () => ({ items: libStorage.getRatings(mediaType) as any[] }),
    staleTime: 0,
  });
}

export function useRatingMutate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "set" | "remove"; mediaType: "movie" | "tv"; tmdbId: number; value?: number; title?: string; posterPath?: string | null }) => {
      if (args.action === "set") {
        return libStorage.setRating({
          mediaType: args.mediaType,
          tmdbId: args.tmdbId,
          value: args.value!,
          title: args.title || "Unknown",
          posterPath: args.posterPath || null,
        });
      } else {
        return libStorage.removeRating(args.mediaType, args.tmdbId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib"] });
    },
  });
}

// Stats
export function useStats() {
  return useQuery({
    queryKey: ["lib", "stats"],
    queryFn: () => libStorage.getStats(),
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

async function mediaGet<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL("/api/media/" + path, window.location.origin);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
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
