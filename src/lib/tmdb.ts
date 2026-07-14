// TMDB API client - proxies all requests through server-side
// TMDB API is free: https://developer.themoviedb.org/

const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim() || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

// Internal helper that surfaces a clear error when the key is missing instead
// of letting TMDB return a generic 401.
function requireTmdbKey(): string {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured. Set it in your environment variables.");
  }
  return TMDB_API_KEY;
}

export function img(path: string | null | undefined, size: string = "w500"): string {
  if (!path) return "";
  // If it's already a full URL (e.g. from Neon DB), return it as-is
  if (path.startsWith("http")) return path;
  // Otherwise build TMDB URL from path
  return `${TMDB_IMG_BASE}/${size}${path}`;
}

export function imgOrPlaceholder(path: string | null | undefined, size: string = "w500"): string {
  if (!path) return "/placeholder-poster.svg";
  // If it's already a full URL (e.g. from Neon DB), return it as-is
  if (path.startsWith("http")) return path;
  // Otherwise build TMDB URL from path
  return `${TMDB_IMG_BASE}/${size}${path}`;
}

/**
 * Timeout for TMDB API requests. 8 seconds is generous enough for normal
 * operation but short enough that a hung TMDB server doesn't block the
 * whole request. Vercel's default function timeout is 10s (Hobby) / 60s
 * (Pro) — we want to fail BEFORE that so the user sees a clear error
 * instead of a 502 from Vercel.
 */
const TMDB_TIMEOUT_MS = 8_000;

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number | boolean> = {}, language: string = "en-US"): Promise<T> {
  const apiKey = requireTmdbKey();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", language);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  // AbortController gives us a hard timeout. Without it, a slow TMDB
  // response can hang the request until Vercel's function timeout,
  // producing a confusing 502 instead of a clear "TMDB timed out" error.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 minutes
      signal: controller.signal,
    });

    if (!res.ok) {
      // Read the body for error context, but cap it so a huge error page
      // doesn't blow up memory.
      const text = (await res.text().catch(() => "")).slice(0, 500);
      throw new Error(`TMDB error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } catch (error) {
    // Distinguish timeout from other network errors so callers can show
    // a "TMDB is slow right now" message instead of a generic failure.
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`TMDB timed out after ${TMDB_TIMEOUT_MS / 1000}s for ${endpoint}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- Types ----------
export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  media_type?: "movie" | "tv" | "person";
  genre_ids?: number[];
  popularity: number;
  original_language?: string;
  origin_country?: string[];
  original_title?: string;
  original_name?: string;
}

export interface PaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface MovieDetail extends MediaItem {
  runtime: number | null;
  genres: Genre[];
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
  production_companies: { id: number; name: string; logo_path: string | null }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { english_name: string; name: string }[];
  imdb_id: string | null;
  homepage: string | null;
  belongs_to_collection: { id: number; name: string; poster_path: string | null } | null;
}

export interface TvDetail extends MediaItem {
  origin_country: string[];
  original_language: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: Season[];
  genres: Genre[];
  tagline: string;
  status: string;
  episode_run_time: number[];
  production_companies: { id: number; name: string; logo_path: string | null }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { english_name: string; name: string }[];
  homepage: string | null;
  in_production: boolean;
  last_air_date: string | null;
  last_episode_to_air?: {
    season_number: number;
    episode_number: number;
    air_date: string | null;
    name: string | null;
  } | null;
  next_episode_to_air?: {
    season_number: number;
    episode_number: number;
    air_date: string | null;
    name: string | null;
  } | null;
  networks: { id: number; name: string; logo_path: string | null }[];
  created_by: { id: number; name: string; profile_path: string | null }[];
}

export interface SeasonDetail {
  id: number;
  name: string;
  season_number: number;
  episodes: Episode[];
  air_date: string | null;
  overview: string;
  poster_path: string | null;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

// ---------- API functions ----------
export const tmdb = {
  // Trending
  trending: (window: "day" | "week" = "week", mediaType: "all" | "movie" | "tv" = "all") =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/trending/${mediaType}/${window}`),

  // Movies
  popularMovies: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/movie/popular`, { page }),
  topRatedMovies: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/movie/top_rated`, { page }),
  nowPlayingMovies: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/movie/now_playing`, { page }),
  upcomingMovies: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/movie/upcoming`, { page }),
  movieGenres: () =>
    tmdbFetch<{ genres: Genre[] }>(`/genre/movie/list`),
  discoverMovies: (params: { genres?: number[]; year?: number; sort_by?: string; page?: number; vote_average_gte?: number; original_language?: string; vote_count_gte?: number; release_date_gte?: string; release_date_lte?: string } = {}) => {
    const p: Record<string, string | number> = { page: params.page || 1, sort_by: params.sort_by || "popularity.desc", "vote_count.gte": params.vote_count_gte ?? 100 };
    if (params.genres && params.genres.length > 0) p.with_genres = params.genres.join(",");
    if (params.year) p.primary_release_year = params.year;
    if (params.vote_average_gte) p["vote_average.gte"] = params.vote_average_gte;
    if (params.original_language) p.with_original_language = params.original_language;
    if (params.release_date_gte) p["primary_release_date.gte"] = params.release_date_gte;
    if (params.release_date_lte) p["primary_release_date.lte"] = params.release_date_lte;
    return tmdbFetch<PaginatedResponse<MediaItem>>(`/discover/movie`, p);
  },

  // TV
  popularTv: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/tv/popular`, { page }),
  topRatedTv: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/tv/top_rated`, { page }),
  onTheAirTv: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/tv/on_the_air`, { page }),
  airingTodayTv: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/tv/airing_today`, { page }),
  tvGenres: () =>
    tmdbFetch<{ genres: Genre[] }>(`/genre/tv/list`),
  discoverTv: (params: { genres?: number[]; year?: number; sort_by?: string; page?: number; vote_average_gte?: number; original_language?: string; vote_count_gte?: number } = {}) => {
    const p: Record<string, string | number> = { page: params.page || 1, sort_by: params.sort_by || "popularity.desc", "vote_count.gte": params.vote_count_gte ?? 100 };
    if (params.genres && params.genres.length > 0) p.with_genres = params.genres.join(",");
    if (params.year) p.first_air_date_year = params.year;
    if (params.vote_average_gte) p["vote_average.gte"] = params.vote_average_gte;
    if (params.original_language) p.with_original_language = params.original_language;
    return tmdbFetch<PaginatedResponse<MediaItem>>(`/discover/tv`, p);
  },

  // Details
  movieDetail: (id: number) =>
    tmdbFetch<MovieDetail>(`/movie/${id}`, { append_to_response: "credits,videos,recommendations,similar,images,release_dates" }),
  tvDetail: (id: number) =>
    tmdbFetch<TvDetail>(`/tv/${id}`, { append_to_response: "credits,videos,recommendations,similar,images,external_ids,content_ratings" }),
  seasonDetail: (tvId: number, seasonNumber: number) =>
    tmdbFetch<SeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`),

  // Search
  searchMulti: (query: string, page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/search/multi`, { query, page, include_adult: false }),
  searchMovies: (query: string, page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/search/movie`, { query, page, include_adult: false }),
  searchTv: (query: string, page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/search/tv`, { query, page, include_adult: false }),

  // Person
  personDetail: (id: number) =>
    tmdbFetch<any>(`/person/${id}`, { append_to_response: "movie_credits,tv_credits,images" }),

  // Discover for calendar (upcoming episodes)
  tvOnTheAir: (page = 1) =>
    tmdbFetch<PaginatedResponse<MediaItem>>(`/tv/on_the_air`, { page }),
};

// ── Arabic-language TMDB calls ─────────────────────────────────────────
// These functions fetch the SAME data as their English counterparts but
// with language=ar so TMDB returns Arabic titles, overviews, and taglines.
// Used by the Arabic Movies / Arabic TV worlds to show "ولاد رزق" instead
// of "Welad Rezk".
//
// Fallback strategy: if the Arabic title is empty (TMDB has no Arabic
// translation for this item), getTitle() falls back to the English title
// via the original_title/original_name fields.
export const tmdbArabic = {
  discoverMovies: (params: { genres?: number[]; year?: number; sort_by?: string; page?: number; vote_average_gte?: number; vote_count_gte?: number; release_date_gte?: string; release_date_lte?: string } = {}) => {
    const p: Record<string, string | number> = { page: params.page || 1, sort_by: params.sort_by || "popularity.desc", "vote_count.gte": params.vote_count_gte ?? 10 };
    if (params.genres && params.genres.length > 0) p.with_genres = params.genres.join(",");
    if (params.year) p.primary_release_year = params.year;
    if (params.vote_average_gte) p["vote_average.gte"] = params.vote_average_gte;
    if (params.release_date_gte) p["primary_release_date.gte"] = params.release_date_gte;
    if (params.release_date_lte) p["primary_release_date.lte"] = params.release_date_lte;
    p.with_original_language = "ar";
    return tmdbFetch<PaginatedResponse<MediaItem>>(`/discover/movie`, p, "ar-SA");
  },

  discoverTv: (params: { genres?: number[]; year?: number; sort_by?: string; page?: number; vote_average_gte?: number; vote_count_gte?: number } = {}) => {
    const p: Record<string, string | number> = { page: params.page || 1, sort_by: params.sort_by || "popularity.desc", "vote_count.gte": params.vote_count_gte ?? 10 };
    if (params.genres && params.genres.length > 0) p.with_genres = params.genres.join(",");
    if (params.year) p.first_air_date_year = params.year;
    if (params.vote_average_gte) p["vote_average.gte"] = params.vote_average_gte;
    p.with_original_language = "ar";
    return tmdbFetch<PaginatedResponse<MediaItem>>(`/discover/tv`, p, "ar-SA");
  },

  movieDetail: (id: number) =>
    tmdbFetch<MovieDetail>(`/movie/${id}`, { append_to_response: "credits,videos,recommendations,similar,images,release_dates" }, "ar-SA"),

  tvDetail: (id: number) =>
    tmdbFetch<TvDetail>(`/tv/${id}`, { append_to_response: "credits,videos,recommendations,similar,images,external_ids,content_ratings" }, "ar-SA"),
};

/**
 * Get the best available title for a media item.
 *
 * For Arabic items (detected via isArabic flag or original_language === "ar"),
 * TMDB with language=ar returns the Arabic title in the `title`/`name` field
 * and the original (transliterated) title in `original_title`/`original_name`.
 *
 * For non-Arabic items, `title`/`name` is the English title.
 *
 * This function returns the localized title, falling back to the original
 * title if the localized one is missing (e.g. TMDB has no Arabic translation).
 */
export function getTitle(m: MediaItem): string {
  return m.title || m.name || m.original_title || m.original_name || "Untitled";
}

/**
 * Get the original (non-localized) title — useful as a subtitle when the
 * main title is in Arabic and you want to show the transliterated version
 * underneath (e.g. "ولاد رزق" as h1, "Welad Rezk" as subtitle).
 */
export function getOriginalTitle(m: MediaItem): string | null {
  const orig = m.original_title || m.original_name;
  const local = m.title || m.name;
  // Only show original title if it differs from the localized one
  // (avoids redundant display for English items where title === original_title).
  if (orig && orig !== local) return orig;
  return null;
}

export function getReleaseDate(m: MediaItem): string {
  return m.release_date || m.first_air_date || "";
}

export function getYear(m: MediaItem): string {
  const d = getReleaseDate(m);
  return d ? d.slice(0, 4) : "";
}
