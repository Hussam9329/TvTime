"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNav } from "@/lib/store";
import type { MediaItem, MovieDetail, TvDetail, PaginatedResponse, SeasonDetail, Genre } from "@/lib/tmdb";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";
import {
  deriveTvTrackingState,
  episodeKey,
  isEpisodeReleased,
  isFutureEpisode,
  isOfficiallyEndedTvStatus,
  type TvTrackingState,
} from "@/lib/tv-status-engine";

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
export type WatchedEpisodeDB = {
  id: string;
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  runtime: number | null;
  watchedAt: string;
};
export type FollowingShowDB = MediaItemDB;
export type RatingDB = MediaItemDB;

// Episode tracking is now server-backed via API

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
  const res = await fetch(withUserId(new URL("/api/media/find-or-create", window.location.origin)), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...userHeaders() },
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

async function ensureApiOk(res: Response, fallback: string): Promise<Response> {
  if (res.ok) return res;
  const errorBody = await res.json().catch(() => ({}));
  throw new Error(errorBody?.error || fallback);
}

// Compatibility mapper: converts a Media DB item to the shape that the
// TMDB-style library hooks (useWatchlist, useWatchedMovies, etc.) used to
// return when backed by localStorage. This keeps existing consumers working
// without having to rewrite every call site.
function mediaToLibraryCompat(m: any) {
  const mediaType = m.type === "series" ? "tv" : m.type;
  return {
    ...m,
    mediaType,
    posterPath: m.posterPath ?? m.poster ?? null,
    backdropPath: m.backdropPath ?? null,
    releaseDate: m.releaseDate ?? (m.year ? `${m.year}-01-01` : null),
    voteAverage: m.voteAverage ?? (m.rating ? Number(m.rating) : null),
    followedAt: m.followedAt ?? m.addedAt ?? m.updatedAt,
    watchedAt: m.watchedAt ?? null,
    value: m.value ?? (m.userRating == null ? undefined : (m.userRating > 10 ? Math.round(m.userRating / 10) : m.userRating)),
  };
}

// Watchlist - reads from Neon (status="planned")
export function useWatchlist(mediaType?: "movie" | "tv") {
  const type = mediaType === "tv" ? "series" : mediaType || undefined;
  return useQuery({
    queryKey: ["media", "watchlist", type],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media", window.location.origin));
      url.searchParams.set("status", "planned");
      if (type) url.searchParams.set("type", type);
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
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
        const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({ status: "planned", watched: false, watchedAt: null }),
        });
        await ensureApiOk(patchRes, "Failed to add to watchlist");
      } else {
        // Remove from watchlist: find by tmdbId and clear status
        const url = withUserId(new URL("/api/media", window.location.origin));
        url.searchParams.set("type", args.mediaType === "tv" ? "series" : "movie");
        const res = await fetch(url, { headers: userHeaders() });
        await ensureApiOk(res, "Failed to find watchlist item");
        const data = await res.json();
        const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
        if (item) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${item.id}`, window.location.origin)), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...userHeaders() },
            body: JSON.stringify({ status: null, watched: false, watchedAt: null }),
          });
          await ensureApiOk(patchRes, "Failed to remove from watchlist");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}


export type RecentlyWatchedItem = {
  id: string;
  kind: "movie" | "tv";
  tmdbId: number | null;
  title: string;
  posterPath: string | null;
  watchedAt: string;
  subtitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeName?: string | null;
  hasProfile: boolean;
  source: "media" | "watched-movie" | "watched-episode";
};

export function useRecentlyWatched(limit = 12) {
  return useQuery({
    queryKey: ["media", "recently", limit],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media/recently", window.location.origin));
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] as RecentlyWatchedItem[], total: 0 };
      const data = await res.json();
      return {
        items: (data.items || []) as RecentlyWatchedItem[],
        total: Number(data.total || data.items?.length || 0),
      };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// Watched Movies - reads from Neon (watched=true)
export function useWatchedMovies() {
  return useQuery({
    queryKey: ["media", "watched-movies"],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media", window.location.origin));
      url.searchParams.set("type", "movie");
      url.searchParams.set("watched", "true");
      // Sort by watchedAt desc so the "Recently Watched" row reflects recency,
      // matching the section name on the home page.
      url.searchParams.set("sortBy", "watchedAt");
      url.searchParams.set("order", "desc");
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
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
        const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({ watched: true, watchedAt: new Date().toISOString(), status: "watched" }),
        });
        await ensureApiOk(patchRes, "Failed to mark movie watched");
      } else {
        // Remove from watched without touching the independent rating
        const url = withUserId(new URL("/api/media", window.location.origin));
        url.searchParams.set("type", "movie");
        const res = await fetch(url, { headers: userHeaders() });
        await ensureApiOk(res, "Failed to find watched movie");
        const data = await res.json();
        const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
        if (item) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${item.id}`, window.location.origin)), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...userHeaders() },
            body: JSON.stringify({ watched: false, watchedAt: null, status: null }),
          });
          await ensureApiOk(patchRes, "Failed to remove movie from watched");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}

// ---------- Episode completion info ----------
// Returned by /api/library/watched-episodes after marking/unmarking episodes.
// The client uses this to decide whether to open the RatingDialog.
export type EpisodeCompletion = {
  newStatus: TvTrackingState;
  isEnded: boolean | null;
  showTmdbId: number;
  mediaId: string;
  needsRating: boolean;
  airedEpisodeCount: number | null;
  watchedAiredEpisodeCount: number;
  ignoredFutureEpisodeCount: number;
  verified: boolean;
};

// Watched Episodes - server-backed via /api/library/watched-episodes
export function useWatchedEpisodes(showId?: number) {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["lib", "watched-episodes", userId || getClientUserId(), showId],
    queryFn: async () => {
      const url = withUserId(new URL("/api/library/watched-episodes", window.location.origin));
      if (showId != null) url.searchParams.set("showId", String(showId));
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] };
      return res.json();
    },
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
    }): Promise<{ item?: any; ok?: boolean; completion?: EpisodeCompletion | null }> => {
      if (args.action === "add") {
        const res = await fetch(withUserId(new URL("/api/library/watched-episodes", window.location.origin)), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({
            showId: args.showId,
            seasonNumber: args.seasonNumber,
            episodeNumber: args.episodeNumber,
            episodeName: args.episodeName,
          }),
        });
        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          throw new Error(errorBody?.error || "Failed to mark episode watched");
        }
        return res.json();
      } else {
        const url = withUserId(new URL("/api/library/watched-episodes", window.location.origin));
        url.searchParams.set("showId", String(args.showId));
        url.searchParams.set("seasonNumber", String(args.seasonNumber));
        url.searchParams.set("episodeNumber", String(args.episodeNumber));
        const res = await fetch(url, { method: "DELETE", headers: userHeaders() });
        if (!res.ok) throw new Error("Failed to unmark episode");
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes"] });
      qc.invalidateQueries({ queryKey: ["lib", "stats"] });
      // Also invalidate media/TV tracking queries so every counter updates immediately.
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}

export function useBulkEpisodeToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      showId: number;
      episodes: { seasonNumber: number; episodeNumber: number; episodeName?: string }[];
    }): Promise<{ ok?: boolean; count?: number; completion?: EpisodeCompletion | null }> => {
      const res = await fetch(withUserId(new URL("/api/library/watched-episodes", window.location.origin)), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify({ showId: args.showId, episodes: args.episodes }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody?.error || "Failed to mark episodes watched");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes"] });
      qc.invalidateQueries({ queryKey: ["lib", "stats"] });
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}

// Following - active TV tracking only; Planned remains a list-only state
export function useFollowing() {
  return useQuery({
    queryKey: ["media", "following"],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media", window.location.origin));
      url.searchParams.set("type", "series");
      url.searchParams.set("status", "not_started,watching,uptodate,finished");
      url.searchParams.set("limit", "500");
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 0,
  });
}

// Tracked Shows - ALL series in the database (watched + unwatched, anime + non-anime)
// Used to check if a show is already tracked (for Follow/Following button state)
export function useTrackedShows() {
  return useQuery({
    queryKey: ["media", "tracked-shows"],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media", window.location.origin));
      url.searchParams.set("type", "series");
      url.searchParams.set("tracked", "true");
      url.searchParams.set("limit", "500");
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 0,
  });
}

export function useFollowingToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "add" | "remove"; tmdbId: number; title: string; posterPath?: string | null; releaseDate?: string; overview?: string; voteAverage?: number }) => {
      if (args.action === "add") {
        // Find-or-create without changing rating or existing progress
        await findOrCreateMedia({
          tmdbId: args.tmdbId,
          title: args.title,
          type: "tv",
          poster: args.posterPath,
          year: args.releaseDate ? args.releaseDate.slice(0, 4) : undefined,
          overview: args.overview,
          rating: args.voteAverage,
        });
        // Following a fresh title means Not Started; completed/progress states stay intact
        const url = withUserId(new URL("/api/media", window.location.origin));
        url.searchParams.set("type", "series");
        url.searchParams.set("limit", "500");
        const res = await fetch(url, { headers: userHeaders() });
        await ensureApiOk(res, "Failed to find TV show");
        const data = await res.json();
        const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
        if (item && !item.watched && (!item.status || item.status === "planned")) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${item.id}`, window.location.origin)), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...userHeaders() },
            body: JSON.stringify({ status: "not_started" }),
          });
          await ensureApiOk(patchRes, "Failed to follow TV show");
        }
      } else {
        // Unfollow: only clear status if not watched, keep watched/rating intact
        const url = withUserId(new URL("/api/media", window.location.origin));
        url.searchParams.set("type", "series");
        url.searchParams.set("limit", "500");
        const res = await fetch(url, { headers: userHeaders() });
        await ensureApiOk(res, "Failed to find TV show");
        const data = await res.json();
        const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
        if (item && !item.watched && (!item.status || item.status === "planned" || item.status === "not_started")) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${item.id}`, window.location.origin)), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...userHeaders() },
            body: JSON.stringify({ status: null }),
          });
          await ensureApiOk(patchRes, "Failed to unfollow TV show");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}

// Ratings - reads from Neon (userRating != null)
export function useRatings(mediaType?: "movie" | "tv") {
  const type = mediaType === "tv" ? "series" : mediaType || undefined;
  return useQuery({
    queryKey: ["media", "ratings", type],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media", window.location.origin));
      url.searchParams.set("rated", "true");
      if (type) url.searchParams.set("type", type);
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) return { items: [] };
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 0,
  });
}

export function useRatingMutate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "set" | "remove"; mediaType: "movie" | "tv"; tmdbId: number; value?: number; title?: string; posterPath?: string | null; releaseDate?: string; overview?: string; voteAverage?: number; runtime?: number | null }) => {
      if (args.action === "set") {
        // Find-or-create, then save only the independent rating
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
        const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({
            userRating: args.value, // stored as 0-100 directly
          }),
        });
        if (!patchRes.ok) {
          const errorBody = await patchRes.json().catch(() => ({}));
          throw new Error(errorBody?.error || "Failed to save rating");
        }
      } else {
        // Remove rating: find by tmdbId and clear
        const url = withUserId(new URL("/api/media", window.location.origin));
        url.searchParams.set("type", args.mediaType === "tv" ? "series" : "movie");
        const res = await fetch(url, { headers: userHeaders() });
        await ensureApiOk(res, "Failed to find rated item");
        const data = await res.json();
        const item = data.items?.find((i: any) => i.tmdbId === args.tmdbId);
        if (item) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${item.id}`, window.location.origin)), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...userHeaders() },
            body: JSON.stringify({ userRating: null }),
          });
          await ensureApiOk(patchRes, "Failed to remove rating");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["lib"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}

// Stats - reads from Neon via library/stats endpoint (includes Media + watched episodes)
export function useStats() {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["lib", "stats", userId || getClientUserId()],
    queryFn: async () => {
      const res = await fetch(withUserId(new URL("/api/library/stats", window.location.origin)), { headers: userHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 0,
  });
}


// TV Tracking - global counts + filtered lists for the TV Tracking/All view.
// Counts are calculated server-side across the whole library, never from the current page.
export type TvTrackingCategory =
  | "all"
  | "planned"
  | "watchlist"
  | "not-started"
  | "havent-started"
  | "watching"
  | "uptodate"
  | "finished"
  | "finished-anime"
  | "upcoming"
  | "havent-watched-while";

export interface TvTrackingCounts {
  all: number;
  planned: number;
  watchlist: number;
  notStarted: number;
  haventStarted: number;
  watching: number;
  uptodate: number;
  finished: number;
  finishedAnime: number;
  upcoming: number;
  haventWatched: number;
}

export interface TvTrackingItem extends MediaItemDB {
  _trackingStatus: TvTrackingState;
  _watchedEpisodeCount: number;
  _watchedAiredEpisodeCount: number;
  _airedEpisodeCount: number | null;
  _ignoredFutureEpisodeCount: number;
  _legacyCompletionAssumed: boolean;
  _legacySnapshotMaterialized?: boolean;
  _stateVerified: boolean;
  _lastWatchedAt: string | null;
  _daysSinceLastWatch: number | null;
  _nextEpisodeAirDate: string | null;
  _nextEpisodeName: string | null;
  _nextEpisodeSeasonNumber: number | null;
  _nextEpisodeNumber: number | null;
}

export interface TvTrackingResponse {
  items: TvTrackingItem[];
  total: number;
  limit: number;
  offset: number;
  category: TvTrackingCategory;
  counts: TvTrackingCounts;
  countsAreGlobal: boolean;
  repairedOnRead?: boolean;
}

export interface TvTrackingCountsResponse {
  counts: TvTrackingCounts;
  countsAreGlobal: boolean;
  repairedOnRead?: boolean;
}

async function tvTrackingGet<T>(params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = withUserId(new URL("/api/tv-tracking", window.location.origin));
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== undefined && String(v) !== "undefined" && String(v) !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), { headers: userHeaders() });
  if (!res.ok) throw new Error(`TV Tracking API ${res.status}`);
  return res.json();
}

export function useTvTrackingCounts() {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["tv-tracking-counts", userId || getClientUserId()],
    queryFn: () => tvTrackingGet<TvTrackingCountsResponse>({ countsOnly: true }),
    staleTime: 30_000,
  });
}

export function useTvTracking(params: {
  category?: TvTrackingCategory;
  search?: string;
  sortBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["tv-tracking", userId || getClientUserId(), params],
    queryFn: () => tvTrackingGet<TvTrackingResponse>(params),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}

// Show progress fetches every regular season, then separates released episodes
// from future episodes. Only released episodes can affect completion or "next".
export function useShowProgress(showId: number | null | undefined) {
  const detail = useTvDetail(showId ?? null);
  const watched = useWatchedEpisodes(showId ?? undefined);
  const trackedShows = useTrackedShows();
  const watchedItems = watched.data?.items ?? [];
  const watchedSignature = watchedItems
    .map((episode: any) => `${episode.showId}-${episode.seasonNumber}-${episode.episodeNumber}-${episode.watchedAt || ""}`)
    .sort()
    .join("|");
  const trackedShow = showId == null
    ? undefined
    : trackedShows.data?.items.find((item: any) => Number(item.tmdbId) === Number(showId));

  const seasonsQuery = useQuery({
    queryKey: ["tmdb", "show-progress-seasons", showId, detail.data?.number_of_seasons ?? 0, watchedSignature, trackedShow?.status, trackedShow?.watched],
    enabled: showId != null && !!detail.data,
    queryFn: async () => {
      const show = detail.data!;
      const regularSeasons = (show.seasons ?? [])
        .filter((season) => season.season_number >= 1 && (season.episode_count ?? 0) > 0)
        .sort((a, b) => a.season_number - b.season_number);
      const seasonDetails = await Promise.all(
        regularSeasons.map((season) => tmdbGet<SeasonDetail>(`tv/${showId}/season/${season.season_number}`)),
      );

      const now = new Date();
      const officiallyEnded = isOfficiallyEndedTvStatus(show.status);
      const allEpisodesIncludingFuture = seasonDetails.flatMap((season) =>
        (season.episodes ?? [])
          .filter((episode) => episode.season_number >= 1)
          .map((episode) => ({ seasonNumber: season.season_number, episode, seasonName: season.name })),
      );
      const allEpisodes = allEpisodesIncludingFuture.filter(({ episode }) =>
        isEpisodeReleased(episode.air_date, now) || (officiallyEnded && !episode.air_date),
      );
      const futureEpisodes = allEpisodesIncludingFuture.filter(({ episode }) => isFutureEpisode(episode.air_date, now));
      const airedKeys = new Set<string>(allEpisodes.map(({ episode }) => episodeKey(episode.season_number, episode.episode_number)));
      const actualWatchedSet = new Set<string>(watchedItems.map((episode: any) => episodeKey(episode.seasonNumber, episode.episodeNumber)));
      const persistedState = String(trackedShow?.status || "");
      const legacyCompleted = actualWatchedSet.size === 0 && Boolean(
        trackedShow?.watched || persistedState === "finished" || persistedState === "uptodate" || persistedState === "watched",
      );
      const derived = deriveTvTrackingState({
        persistedStatus: trackedShow?.status,
        officiallyEnded,
        airedEpisodeCount: allEpisodes.length,
        airedEpisodeKeys: airedKeys,
        watchedEpisodeKeys: actualWatchedSet,
        legacyCompleted,
      });
      const watchedSet = new Set(actualWatchedSet);
      if (derived.legacyCompletionAssumed) {
        for (const key of airedKeys) watchedSet.add(key);
      }

      const nextEp = allEpisodes.find(({ episode }) => !watchedSet.has(episodeKey(episode.season_number, episode.episode_number))) ?? null;
      const nextUpcomingEpisode = futureEpisodes
        .sort((a, b) => Date.parse(a.episode.air_date || "") - Date.parse(b.episode.air_date || ""))[0] ?? null;
      const lastWatchedDate = watchedItems.length > 0
        ? new Date(watchedItems.reduce((latest: string, episode: any) => episode.watchedAt > latest ? episode.watchedAt : latest, watchedItems[0].watchedAt))
        : null;
      const daysSinceLastWatch = lastWatchedDate
        ? Math.floor((Date.now() - lastWatchedDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        showDetail: show,
        watchedSet,
        actualWatchedSet,
        watchedItems,
        totalEpisodes: allEpisodes.length,
        totalKnownEpisodes: allEpisodesIncludingFuture.length,
        watchedCount: derived.watchedAiredEpisodeCount,
        ignoredFutureWatchedCount: derived.futureOrUnknownWatchedEpisodeCount,
        trackingState: derived.state,
        stateVerified: derived.verified,
        legacyCompletionAssumed: derived.legacyCompletionAssumed,
        nextEp,
        nextUpcomingEpisode,
        allEpisodes,
        allEpisodesIncludingFuture,
        futureEpisodes,
        seasons: seasonDetails.map((season) => ({
          seasonNumber: season.season_number,
          episodes: season.episodes ?? [],
          seasonName: season.name,
        })),
        lastWatchedDate,
        daysSinceLastWatch,
        nextEpAirDate: nextEp?.episode?.air_date ? new Date(nextEp.episode.air_date) : null,
        isUpcoming: Boolean(nextUpcomingEpisode && nextEp == null),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    showDetail: detail.data,
    watchedSet: new Set<string>(watchedItems.map((episode: any) => episodeKey(episode.seasonNumber, episode.episodeNumber))),
    actualWatchedSet: new Set<string>(watchedItems.map((episode: any) => episodeKey(episode.seasonNumber, episode.episodeNumber))),
    watchedItems,
    totalEpisodes: 0,
    totalKnownEpisodes: detail.data?.number_of_episodes ?? 0,
    watchedCount: 0,
    ignoredFutureWatchedCount: 0,
    trackingState: (trackedShow?.status || "not_started") as TvTrackingState,
    stateVerified: false,
    legacyCompletionAssumed: false,
    nextEp: null,
    nextUpcomingEpisode: null,
    allEpisodes: [],
    allEpisodesIncludingFuture: [],
    futureEpisodes: [],
    seasons: [],
    lastWatchedDate: null,
    daysSinceLastWatch: null,
    nextEpAirDate: null,
    isUpcoming: false,
    ...(seasonsQuery.data ?? {}),
    isLoading: detail.isLoading || watched.isLoading || trackedShows.isLoading || seasonsQuery.isLoading,
    isError: detail.isError || watched.isError || trackedShows.isError || seasonsQuery.isError,
  };
}

// ---------- Media (Neon PostgreSQL backend) ----------
export interface MediaItemDB {
  id: string;
  tmdbId: number | null;
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
  isAnime: boolean;
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
    watchlist?: number;
    watchlistMovies?: number;
    watchlistShows?: number;
    watchlistAnime?: number;
    watchedMovies?: number;
    watchedShows?: number;
    watchedAnime?: number;
    watchedEpisodes?: number;
    following?: number;
    ratings?: number;
  };
  ratingDist: { value: number; count: number }[];
  typeDist: { type: string; count: number }[];
  topRated: { id: string; title: string; poster: string | null; userRating: number | null; type: string; year: string | null }[];
  recentlyAdded: { id: string; title: string; poster: string | null; type: string; year: string | null; addedAt: string }[];
  avgRating: number;
}

async function mediaGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = withUserId(new URL("/api/media/" + path, window.location.origin));
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== undefined && String(v) !== "undefined" && String(v) !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), { headers: userHeaders() });
  if (!res.ok) throw new Error(`Media API ${res.status}`);
  return res.json();
}

export function useMedia(params: {
  type?: string;
  status?: string;
  watched?: string;
  rated?: string;
  isAnime?: string;
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
      const res = await fetch(withUserId(new URL(`/api/media/${args.id}`, window.location.origin)), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody?.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}
