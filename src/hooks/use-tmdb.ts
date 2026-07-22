"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export type HomeFeedResponse = {
  trending: PaginatedResponse<MediaItem>;
  popularMovies: PaginatedResponse<MediaItem>;
  topRatedMovies: PaginatedResponse<MediaItem>;
  upcomingMovies: PaginatedResponse<MediaItem>;
  popularTv: PaginatedResponse<MediaItem>;
  onTheAirTv: PaginatedResponse<MediaItem>;
  topRatedTv: PaginatedResponse<MediaItem>;
};

/** One browser request for every public catalogue row on the home screen. */
export function useHomeFeed() {
  return useQuery({
    queryKey: ["tmdb", "home"],
    queryFn: () => tmdbGet<HomeFeedResponse>("home"),
    staleTime: 5 * 60 * 1000,
  });
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

export function useDiscoverMovies(params: { genres?: number[]; year?: number; sort_by?: string; page?: number; rating?: number; originalLanguage?: string; voteCount?: number; releaseDateFrom?: string; releaseDateTo?: string; certification?: string; runtimeGte?: number; runtimeLte?: number; keywordQuery?: string; language?: "ar" | "ja" | "en-US"; enabled?: boolean }) {
  return useQuery({
    queryKey: ["tmdb", "movies", "discover", params],
    queryFn: () =>
      tmdbGet<PaginatedResponse<MediaItem>>("movies/discover", {
        ...(params.genres && params.genres.length > 0 ? { genre: params.genres.join(",") } : {}),
        ...(params.year ? { year: params.year } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
        page: params.page || 1,
        ...(params.rating ? { rating: params.rating } : {}),
        ...(params.originalLanguage ? { original_language: params.originalLanguage } : {}),
        ...(params.voteCount != null ? { vote_count: params.voteCount } : {}),
        ...(params.releaseDateFrom ? { release_date_gte: params.releaseDateFrom } : {}),
        ...(params.releaseDateTo ? { release_date_lte: params.releaseDateTo } : {}),
        ...(params.certification ? { certification: params.certification } : {}),
        ...(params.runtimeGte != null ? { runtime_gte: params.runtimeGte } : {}),
        ...(params.runtimeLte != null ? { runtime_lte: params.runtimeLte } : {}),
        ...(params.keywordQuery ? { keyword_query: params.keywordQuery } : {}),
        ...(params.language ? { language: params.language } : {}),
      }),
    enabled: params.enabled !== false,
  });
}

export function useDiscoverTv(params: { genres?: number[]; year?: number; sort_by?: string; page?: number; rating?: number; originalLanguage?: string; voteCount?: number; releaseDateFrom?: string; releaseDateTo?: string; runtimeGte?: number; runtimeLte?: number; keywordQuery?: string; language?: "ar" | "ja" | "en-US"; enabled?: boolean }) {
  return useQuery({
    queryKey: ["tmdb", "tv", "discover", params],
    queryFn: () =>
      tmdbGet<PaginatedResponse<MediaItem>>("tv/discover", {
        ...(params.genres && params.genres.length > 0 ? { genre: params.genres.join(",") } : {}),
        ...(params.year ? { year: params.year } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
        page: params.page || 1,
        ...(params.rating ? { rating: params.rating } : {}),
        ...(params.originalLanguage ? { original_language: params.originalLanguage } : {}),
        ...(params.voteCount != null ? { vote_count: params.voteCount } : {}),
        // Bug fix: previously TV discover silently dropped year-range filters.
        ...(params.releaseDateFrom ? { release_date_gte: params.releaseDateFrom } : {}),
        ...(params.releaseDateTo ? { release_date_lte: params.releaseDateTo } : {}),
        ...(params.runtimeGte != null ? { runtime_gte: params.runtimeGte } : {}),
        ...(params.runtimeLte != null ? { runtime_lte: params.runtimeLte } : {}),
        ...(params.keywordQuery ? { keyword_query: params.keywordQuery } : {}),
        ...(params.language ? { language: params.language } : {}),
      }),
    enabled: params.enabled !== false,
  });
}

export type FilteredDiscoverResponse = {
  results: MediaItem[];
  has_more: boolean;
  next_cursor: string | null;
  partial?: boolean;
  scan?: {
    pages_fetched: number;
    page_budget: number;
    budget_exhausted: boolean;
  };
};

export function useFilteredDiscover(params: {
  mediaType: "movie" | "tv";
  showMe: "seen" | "unseen";
  cursor?: string | null;
  genres?: number[];
  sort_by?: string;
  rating?: number;
  maxRating?: number;
  originalLanguage?: string;
  voteCount?: number;
  releaseDateFrom?: string;
  releaseDateTo?: string;
  certification?: string;
  runtimeGte?: number;
  runtimeLte?: number;
  keywordQuery?: string;
  language?: "ar" | "ja" | "en-US";
  excludeArabic?: boolean;
  onlyArabic?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["media", "discover-filtered", getClientUserId(), params],
    queryFn: async () => {
      const url = withUserId(new URL("/api/discover/filtered", window.location.origin));
      url.searchParams.set("media_type", params.mediaType);
      url.searchParams.set("show_me", params.showMe);
      if (params.cursor) url.searchParams.set("cursor", params.cursor);
      if (params.genres?.length) url.searchParams.set("genre", params.genres.join(","));
      if (params.sort_by) url.searchParams.set("sort_by", params.sort_by);
      if (params.rating != null) url.searchParams.set("rating", String(params.rating));
      if (params.maxRating != null) url.searchParams.set("max_rating", String(params.maxRating));
      if (params.originalLanguage) url.searchParams.set("original_language", params.originalLanguage);
      if (params.voteCount != null) url.searchParams.set("vote_count", String(params.voteCount));
      if (params.releaseDateFrom) url.searchParams.set("release_date_gte", params.releaseDateFrom);
      if (params.releaseDateTo) url.searchParams.set("release_date_lte", params.releaseDateTo);
      if (params.certification) url.searchParams.set("certification", params.certification);
      if (params.runtimeGte != null) url.searchParams.set("runtime_gte", String(params.runtimeGte));
      if (params.runtimeLte != null) url.searchParams.set("runtime_lte", String(params.runtimeLte));
      if (params.keywordQuery) url.searchParams.set("keyword_query", params.keywordQuery);
      if (params.language) url.searchParams.set("language", params.language);
      if (params.excludeArabic) url.searchParams.set("exclude_arabic", "true");
      if (params.onlyArabic) url.searchParams.set("only_arabic", "true");

      const res = await fetch(url, { headers: userHeaders() });
      await ensureApiOk(res, "Failed to load filtered Discover results");
      return res.json() as Promise<FilteredDiscoverResponse>;
    },
    enabled: params.enabled !== false,
    staleTime: 30_000,
  });
}

export function useSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ["tmdb", "search", query, page],
    queryFn: () => tmdbGet<PaginatedResponse<MediaItem>>("search", { q: query, page }),
    enabled: query.trim().length > 0,
  });
}

// TVM-31/32: Multi-page search with accumulated results + separate People results.
// Returns accumulated movie/tv results across all loaded pages, plus a separate
// people array. Supports Load More via nextPage.
// Uses refs + "adjust state during render" pattern to avoid setState-in-effect.
export function useSearchAccumulated(query: string) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<MediaItem[]>([]);
  const [people, setPeople] = useState<MediaItem[]>([]);
  const [lastQuery, setLastQuery] = useState(query);
  const [lastPage, setLastPage] = useState(0);

  const search = useSearch(query.trim().length > 0 ? query : "", page);

  // Reset accumulation when query changes (adjust state during render pattern)
  if (query !== lastQuery) {
    setLastQuery(query);
    setAccumulated([]);
    setPeople([]);
    setPage(1);
    setLastPage(0);
  }

  // Accumulate results when new page data arrives (adjust state during render)
  const dataPage = search.data?.results;
  const currentPage = page;
  if (search.data && currentPage !== lastPage) {
    setLastPage(currentPage);
    const newMedia = (dataPage ?? []).filter((r) => r.media_type !== "person" && (r.poster_path || r.backdrop_path));
    const newPeople = (dataPage ?? []).filter((r) => r.media_type === "person");
    setAccumulated((prev) => {
      const seen = new Set(prev.map((r) => `${r.media_type}-${r.id}`));
      const unique = newMedia.filter((r) => !seen.has(`${r.media_type}-${r.id}`));
      return [...prev, ...unique];
    });
    setPeople((prev) => {
      const seen = new Set(prev.map((r) => `person-${r.id}`));
      const unique = newPeople.filter((r) => !seen.has(`person-${r.id}`));
      return [...prev, ...unique];
    });
  }

  const totalPages = Math.min(search.data?.total_pages ?? 1, 500);
  const totalResults = search.data?.total_results ?? 0;
  const hasMore = page < totalPages;

  const loadMore = () => {
    if (hasMore && !search.isFetching) setPage((p) => p + 1);
  };

  return {
    accumulated,
    people,
    isLoading: search.isLoading,
    isFetching: search.isFetching && page > 1,
    isError: search.isError,
    hasMore,
    loadMore,
    totalResults,
    currentPage: page,
    totalPages,
  };
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
  originCountry?: string[] | null;
  originalLanguage?: string | null;
  seasons?: number | null;
  episodes?: number | null;
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
      originCountry: args.originCountry,
      originalLanguage: args.originalLanguage,
      seasons: args.seasons,
      episodes: args.episodes,
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

/**
 * TVM Fix: Direct state lookup by tmdbId + type — NO pagination.
 * Returns the media item's DB id, or null if not found.
 * Throws on server error (not silent return null).
 */
async function getMediaIdByTmdbId(tmdbId: number, mediaType: "movie" | "tv"): Promise<string | null> {
  const url = withUserId(new URL("/api/media/state", window.location.origin));
  url.searchParams.set("tmdbId", String(tmdbId));
  url.searchParams.set("type", mediaType);
  const res = await fetch(url, { headers: userHeaders() });
  if (!res.ok) throw new Error(`Failed to load media state (${res.status})`);
  const data = await res.json();
  return data.item?.id ?? null;
}

/**
 * TVM Fix: useMediaState — fetch a single item's state by tmdbId.
 * Used by detail pages to know if a movie is in watchlist/watched/rated
 * without paginating through the entire library.
 */
export function useMediaState(tmdbId: number | null, mediaType: "movie" | "tv") {
  return useQuery({
    queryKey: ["media", "state", getClientUserId(), mediaType, tmdbId],
    queryFn: async () => {
      if (!tmdbId) return null;
      const url = withUserId(new URL("/api/media/state", window.location.origin));
      url.searchParams.set("tmdbId", String(tmdbId));
      url.searchParams.set("type", mediaType);
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) throw new Error(`Failed to load media state (${res.status})`);
      const data = await res.json();
      return data.item;
    },
    enabled: tmdbId != null && tmdbId > 0,
    staleTime: 30_000,
  });
}

export type MediaBatchState = {
  id: string;
  tmdbId: number;
  type: "movie" | "series";
  status: string | null;
  watched: boolean;
  userRating: number | null;
  isAnime: boolean;
  isArabic: boolean;
  originalLanguage: string | null;
  originCountries: string[];
  isFollowing: boolean;
  inWatchlist: boolean;
};

export function mediaStateKey(mediaType: "movie" | "tv", tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

/**
 * Loads only the state for cards currently rendered on screen. This avoids
 * deriving badges from the first page of a globally paginated library.
 */
export function useMediaStates(
  items: { tmdbId: number; mediaType: "movie" | "tv" }[],
  options: { enabled?: boolean } = {},
) {
  const normalized = Array.from(
    new Map(
      items
        .filter((item) => Number.isInteger(item.tmdbId) && item.tmdbId > 0)
        .map((item) => [mediaStateKey(item.mediaType, item.tmdbId), item]),
    ).values(),
  ).sort((a, b) => mediaStateKey(a.mediaType, a.tmdbId).localeCompare(mediaStateKey(b.mediaType, b.tmdbId)));
  const signature = normalized.map((item) => mediaStateKey(item.mediaType, item.tmdbId)).join("|");

  return useQuery({
    queryKey: ["media", "states", getClientUserId(), signature],
    queryFn: async () => {
      if (normalized.length === 0) return {} as Record<string, MediaBatchState>;

      // The API deliberately caps each request. Large grids are split into
      // bounded batches so a page with more than 200 rendered cards never
      // falls back to missing badges or a 413 response.
      const chunks: typeof normalized[] = [];
      for (let index = 0; index < normalized.length; index += 200) {
        chunks.push(normalized.slice(index, index + 200));
      }

      const responses = await Promise.all(chunks.map(async (chunk) => {
        const res = await fetch(withUserId(new URL("/api/media/states", window.location.origin)), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({ items: chunk }),
        });
        await ensureApiOk(res, "Failed to load media card states");
        const data = await res.json();
        return (data.states || {}) as Record<string, MediaBatchState>;
      }));

      return Object.assign({}, ...responses) as Record<string, MediaBatchState>;
    },
    enabled: options.enabled !== false && normalized.length > 0,
    staleTime: 30_000,
  });
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
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 30_000,
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
      genres?: string[];
      originCountry?: string[] | null;
      originalLanguage?: string | null;
      seasons?: number | null;
      episodes?: number | null;
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
          genres: args.genres,
          originCountry: args.originCountry,
          originalLanguage: args.originalLanguage,
          seasons: args.seasons,
          episodes: args.episodes,
        });
        const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({ status: "planned" }),
        });
        await ensureApiOk(patchRes, "Failed to add to watchlist");
      } else {
        // Remove from watchlist: find by tmdbId DIRECTLY (not via paginated list .find())
        const id = await getMediaIdByTmdbId(args.tmdbId, args.mediaType);
        if (id) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...userHeaders() },
            body: JSON.stringify({ status: null }),
          });
          await ensureApiOk(patchRes, "Failed to remove from watchlist");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["library-counts"] });
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
  source: "media" | "watched-episode";
};

export function useRecentlyWatched(limit = 12) {
  return useQuery({
    queryKey: ["media", "recently", limit],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media/recently", window.location.origin));
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) throw new Error("Failed to load recently watched");
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
export function useWatchedMovies(opts?: { enabled?: boolean }) {
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
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 30_000,
    enabled: opts?.enabled !== false,
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
      genres?: string[];
      originCountry?: string[] | null;
      originalLanguage?: string | null;
      seasons?: number | null;
      episodes?: number | null;
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
          genres: args.genres,
          originCountry: args.originCountry,
          originalLanguage: args.originalLanguage,
          seasons: args.seasons,
          episodes: args.episodes,
        });
        const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({ watched: true, watchedAt: new Date().toISOString(), status: "watched" }),
        });
        await ensureApiOk(patchRes, "Failed to mark movie watched");
      } else {
        // Remove from watched without touching the independent rating
        // TVM Fix: find by tmdbId DIRECTLY (not via paginated list .find())
        const id = await getMediaIdByTmdbId(args.tmdbId, "movie");
        if (id) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
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
      qc.invalidateQueries({ queryKey: ["library-counts"] });
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
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody?.error || "Failed to load watched episodes");
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

export type EpisodeWatchTimeline = {
  releasedEpisodes: Array<{
    seasonNumber: number;
    episodeNumber: number;
    episodeName?: string | null;
  }>;
  watchedKeys: string[];
  source: string;
};

export function useEpisodeWatchTimeline(showId?: number | null) {
  const userId = useNav((s) => s.userId);
  const numericShowId = Number(showId || 0);
  return useQuery({
    queryKey: ["episode-watch-plan", userId || getClientUserId(), numericShowId],
    enabled: numericShowId > 0,
    queryFn: async () => {
      const url = withUserId(new URL("/api/library/watched-episodes/plan", window.location.origin));
      url.searchParams.set("showId", String(numericShowId));
      const res = await fetch(url, { headers: userHeaders() });
      await ensureApiOk(res, "Failed to verify earlier episode progress");
      return res.json() as Promise<EpisodeWatchTimeline>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          throw new Error(errorBody?.error || "Failed to unmark episode");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib", "watched-episodes"] });
      qc.invalidateQueries({ queryKey: ["lib", "stats"] });
      // Also invalidate media/TV tracking queries so every counter updates immediately.
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["library-counts"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
      qc.invalidateQueries({ queryKey: ["episode-watch-plan"] });
    },
  });
}

export function useBulkEpisodeToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      showId: number;
      episodes: { seasonNumber: number; episodeNumber: number; episodeName?: string | null }[];
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
      qc.invalidateQueries({ queryKey: ["library-counts"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
      qc.invalidateQueries({ queryKey: ["episode-watch-plan"] });
    },
  });
}

export type ArabicMovieScheduleResponse = {
  from: string;
  to: string;
  items: MediaItem[];
  total: number;
  pagesFetched: number;
  truncated: boolean;
};

export function useArabicMovieSchedule(from: string, to: string) {
  return useQuery({
    queryKey: ["arabic-movies", "release-schedule", from, to],
    queryFn: async (): Promise<ArabicMovieScheduleResponse> => {
      const url = new URL("/api/arabic-movies/calendar", window.location.origin);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      const res = await fetch(url);
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody?.error || "Failed to load Arabic movie releases");
      }
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type MovieScheduleResponse = ArabicMovieScheduleResponse;

export type ReleaseScheduleOptions = {
  language?: "ar" | "ja" | "en-US";
  originalLanguage?: string;
  excludedOriginalLanguage?: string;
  genres?: number[];
  withoutGenres?: number[];
};

export function useReleaseSchedule(
  mediaType: "movie" | "tv",
  from: string,
  to: string,
  opts?: ReleaseScheduleOptions,
) {
  return useQuery({
    queryKey: ["release-schedule", mediaType, from, to, opts],
    queryFn: async (): Promise<MovieScheduleResponse> => {
      const url = new URL(mediaType === "tv" ? "/api/tv/calendar" : "/api/movies/calendar", window.location.origin);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      if (opts?.language) url.searchParams.set("language", opts.language);
      if (opts?.originalLanguage) url.searchParams.set("original_language", opts.originalLanguage);
      if (opts?.excludedOriginalLanguage) url.searchParams.set("exclude_original_language", opts.excludedOriginalLanguage);
      if (opts?.genres?.length) url.searchParams.set("genre", opts.genres.join(","));
      if (opts?.withoutGenres?.length) url.searchParams.set("without_genre", opts.withoutGenres.join(","));
      const res = await fetch(url);
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody?.error || `Failed to load ${mediaType} releases`);
      }
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * General movie release schedule. Same shape as useArabicMovieSchedule but
 * hits /api/movies/calendar (which supports any language filter).
 * Pass language="ar" or "ja" to get localized titles/posters.
 * Pass originalLanguage="ar" to filter to only Arabic-origin films.
 */
export function useMovieSchedule(
  from: string,
  to: string,
  opts?: { language?: "ar" | "ja" | "en-US"; originalLanguage?: string }
) {
  return useReleaseSchedule("movie", from, to, opts);
}

// Following - active TV tracking only; Planned remains a list-only state
export function useFollowing(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["media", "following"],
    queryFn: async () => {
      const url = withUserId(new URL("/api/media", window.location.origin));
      url.searchParams.set("type", "series");
      url.searchParams.set("tracked", "true");
      url.searchParams.set("isAnime", "false");
      url.searchParams.set("isArabic", "false");
      url.searchParams.set("limit", "500");
      const res = await fetch(url, { headers: userHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 30_000,
    enabled: opts?.enabled !== false,
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
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 30_000,
  });
}

export type FollowingToggleResult = {
  ok?: boolean;
  changed: boolean;
  action: string;
  item?: any;
  deletedEpisodes?: number;
  deletedRatings?: number;
  message?: string;
};

export function useFollowingToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      action: "add" | "remove";
      tmdbId: number;
      title: string;
      posterPath?: string | null;
      releaseDate?: string;
      overview?: string;
      voteAverage?: number;
      genres?: string[];
      originCountry?: string[] | null;
      originalLanguage?: string | null;
      seasons?: number | null;
      episodes?: number | null;
      keepProgress?: boolean;
    }): Promise<FollowingToggleResult> => {
      if (args.action === "remove") {
        const res = await fetch(withUserId(new URL("/api/tv-tracking/unfollow", window.location.origin)), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...userHeaders() },
          body: JSON.stringify({
            tmdbId: args.tmdbId,
            keepProgress: args.keepProgress !== false,
          }),
        });
        await ensureApiOk(res, "Failed to unfollow TV show");
        return res.json();
      }

      await findOrCreateMedia({
        tmdbId: args.tmdbId,
        title: args.title,
        type: "tv",
        poster: args.posterPath,
        year: args.releaseDate ? args.releaseDate.slice(0, 4) : undefined,
        overview: args.overview,
        rating: args.voteAverage,
        genres: args.genres,
        originCountry: args.originCountry,
        originalLanguage: args.originalLanguage,
        seasons: args.seasons,
        episodes: args.episodes,
      });

      const stateUrl = withUserId(new URL("/api/media/state", window.location.origin));
      stateUrl.searchParams.set("tmdbId", String(args.tmdbId));
      stateUrl.searchParams.set("type", "tv");
      const stateRes = await fetch(stateUrl, { headers: userHeaders() });
      await ensureApiOk(stateRes, "Failed to verify TV show state");
      const stateData = await stateRes.json();
      const item = stateData.item;
      if (!item) throw new Error("TV show state was not found after saving it");

      if (item.isFollowing === true) {
        return { changed: false, action: "already_following", item };
      }

      const followRes = await fetch(withUserId(new URL("/api/library/following", window.location.origin)), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify({
          tmdbId: args.tmdbId,
          title: args.title,
          posterPath: args.posterPath,
        }),
      });
      await ensureApiOk(followRes, "Failed to follow TV show");
      const followData = await followRes.json();
      return {
        ...followData,
        changed: Boolean(followData.changed),
        action: followData.changed ? "follow" : "already_following",
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["library-counts"] });
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
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      return { items: (data.items || []).map((s: any) => mediaToLibraryCompat(s)) };
    },
    staleTime: 30_000,
  });
}

export interface EpisodeRatingDB {
  id: string;
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  posterPath: string | null;
  value: number;
  updatedAt: string;
  scope: "episode";
}

export function useEpisodeRatings(showId: number | null | undefined) {
  const numericShowId = Number(showId || 0);
  return useQuery({
    queryKey: ["episode-ratings", numericShowId],
    enabled: numericShowId > 0,
    queryFn: async () => {
      const url = withUserId(new URL("/api/library/ratings", window.location.origin));
      url.searchParams.set("mediaType", "episode");
      url.searchParams.set("showId", String(numericShowId));
      const res = await fetch(url, { headers: userHeaders() });
      await ensureApiOk(res, "Failed to load episode ratings");
      return res.json() as Promise<{ items: EpisodeRatingDB[] }>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useEpisodeRatingMutate(showId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      action: "set" | "remove";
      seasonNumber: number;
      episodeNumber: number;
      value?: number;
      showTitle?: string;
      episodeName?: string;
      posterPath?: string | null;
    }) => {
      const url = withUserId(new URL("/api/library/ratings", window.location.origin));
      if (args.action === "remove") {
        url.searchParams.set("mediaType", "episode");
        url.searchParams.set("showId", String(showId));
        url.searchParams.set("seasonNumber", String(args.seasonNumber));
        url.searchParams.set("episodeNumber", String(args.episodeNumber));
        const res = await fetch(url, { method: "DELETE", headers: userHeaders() });
        await ensureApiOk(res, "Failed to remove episode rating");
        return res.json();
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify({
          mediaType: "episode",
          showId,
          seasonNumber: args.seasonNumber,
          episodeNumber: args.episodeNumber,
          value: args.value,
          showTitle: args.showTitle,
          episodeName: args.episodeName,
          posterPath: args.posterPath,
        }),
      });
      await ensureApiOk(res, "Failed to save episode rating");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["episode-ratings", showId] });
    },
  });
}

export function useRatingMutate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: "set" | "remove"; mediaType: "movie" | "tv"; tmdbId: number; value?: number; title?: string; posterPath?: string | null; releaseDate?: string; overview?: string; voteAverage?: number; runtime?: number | null; genres?: string[]; originCountry?: string[] | null; originalLanguage?: string | null; seasons?: number | null; episodes?: number | null }) => {
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
          genres: args.genres,
          originCountry: args.originCountry,
          originalLanguage: args.originalLanguage,
          seasons: args.seasons,
          episodes: args.episodes,
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
        // Remove rating: find by tmdbId DIRECTLY (not via paginated list .find())
        const id = await getMediaIdByTmdbId(args.tmdbId, args.mediaType);
        if (id) {
          const patchRes = await fetch(withUserId(new URL(`/api/media/${id}`, window.location.origin)), {
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
      qc.invalidateQueries({ queryKey: ["library-counts"] });
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
    staleTime: 60_000,
  });
}


// TV Tracking - global counts + filtered lists for the TV Tracking/All view.
// Counts are calculated server-side across the whole library, never from the current page.
export type TvTrackingCategory =
  | "all"
  | "watchlist"
  | "uptodate"
  | "finished"
  | "upcoming"
  | "havent-watched"
  | "havent-started";

export interface TvTrackingCounts {
  all: number;
  planned: number;
  watchlist: number;
  notStarted: number;
  haventStarted: number;
  watching: number;
  uptodate: number;
  finished: number;
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
  _hasUnwatchedReleasedEpisode: boolean;
  _isStaleWatching: boolean;
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
  world?: "standard" | "arabic";
}

export interface TvTrackingCountsResponse {
  counts: TvTrackingCounts;
  countsAreGlobal: boolean;
  repairedOnRead?: boolean;
  world?: "standard" | "arabic";
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

export function useTvTrackingCounts(world: "standard" | "arabic" = "standard") {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["tv-tracking-counts", userId || getClientUserId(), world],
    queryFn: () => tvTrackingGet<TvTrackingCountsResponse>({ countsOnly: true, world }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useTvTracking(params: {
  category?: TvTrackingCategory;
  search?: string;
  sortBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
  world?: "standard" | "arabic";
} = {}) {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["tv-tracking", userId || getClientUserId(), params],
    queryFn: () => tvTrackingGet<TvTrackingResponse>(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

// Show progress fetches every regular season, then separates released episodes
// from future episodes. Only released episodes can affect completion or "next".
export function useShowProgress(showId: number | null | undefined) {
  const detail = useTvDetail(showId ?? null);
  const watched = useWatchedEpisodes(showId ?? undefined);
  const mediaState = useMediaState(showId ?? null, "tv");
  const watchedItems = watched.data?.items ?? [];
  const watchedSignature = watchedItems
    .map((episode: any) => `${episode.showId}-${episode.seasonNumber}-${episode.episodeNumber}-${episode.watchedAt || ""}`)
    .sort()
    .join("|");
  const trackedShow = mediaState.data ?? undefined;
  const isFollowing = Boolean(trackedShow?.isFollowing);

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
        trackingState: trackedShow?.isFollowing
          || trackedShow?.status
          || trackedShow?.watched
          || actualWatchedSet.size > 0
          ? derived.state
          : null,
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
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
    trackingState: (trackedShow?.status || (watchedItems.length > 0 ? "watching" : null)) as TvTrackingState | null,
    isFollowing,
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
    mediaItem: trackedShow,
    isLoading: detail.isLoading || watched.isLoading || mediaState.isLoading || seasonsQuery.isLoading,
    isError: detail.isError || watched.isError || mediaState.isError || seasonsQuery.isError,
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
  isArabic: boolean;
  originalLanguage: string | null;
  originCountries: string[];
  isFollowing: boolean;
}

export interface MediaStats {
  counts: {
    total: number;
    movies: number;
    series: number;
    rated: number;
    ratedMovies?: number;
    ratedShows?: number;
    ratedAnime?: number;
    watched: number;
    planned: number;
    watchlist?: number;
    watchlistMovies?: number;
    watchlistShows?: number;
    watchlistAnime?: number;
    watchedMovies?: number;
    watchedShows?: number;
    watchedAnime?: number;
    notStartedAnime?: number;
    watchingAnime?: number;
    watchlistArabicMovies?: number;
    watchedArabicMovies?: number;
    watchlistArabicShows?: number;
    notStartedArabicShows?: number;
    watchingArabicShows?: number;
    finishedArabicShows?: number;
    followingArabicShows?: number;
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
  tracked?: string;
  isAnime?: string;
  isArabic?: string;
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


export interface GlobalLibraryCountsResponse {
  counts: MediaStats["counts"];
  countsAreGlobal: true;
  source: "Media";
}

export function useLibraryCounts() {
  const userId = useNav((s) => s.userId);
  return useQuery({
    queryKey: ["library-counts", userId || getClientUserId()],
    queryFn: async () => {
      const res = await fetch(withUserId(new URL("/api/library/counts", window.location.origin)), { headers: userHeaders() });
      await ensureApiOk(res, "Failed to load global library counts");
      return res.json() as Promise<GlobalLibraryCountsResponse>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Update mutable media state. World classification is server-owned and immutable here.
export function useMediaUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      userRating?: number | null;
      watched?: boolean;
      watchedAt?: string | null;
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
      qc.invalidateQueries({ queryKey: ["library-counts"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking"] });
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] });
    },
  });
}
