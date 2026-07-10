// TMDB API client - proxies all requests through server-side
// TMDB API is free: https://developer.themoviedb.org/

const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

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

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    next: { revalidate: 300 }, // cache 5 minutes
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TMDB error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
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
  spoken_languages: { english_name: string; name: string }[];
  imdb_id: string | null;
  homepage: string | null;
  belongs_to_collection: { id: number; name: string; poster_path: string | null } | null;
}

export interface TvDetail extends MediaItem {
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: Season[];
  genres: Genre[];
  tagline: string;
  status: string;
  episode_run_time: number[];
  production_companies: { id: number; name: string; logo_path: string | null }[];
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
  discoverMovies: (params: { genres?: number[]; year?: number; sort_by?: string; page?: number; vote_average_gte?: number } = {}) => {
    const p: Record<string, string | number> = { page: params.page || 1, sort_by: params.sort_by || "popularity.desc", "vote_count.gte": 100 };
    if (params.genres && params.genres.length > 0) p.with_genres = params.genres.join(",");
    if (params.year) p.primary_release_year = params.year;
    if (params.vote_average_gte) p["vote_average.gte"] = params.vote_average_gte;
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
  discoverTv: (params: { genres?: number[]; year?: number; sort_by?: string; page?: number; vote_average_gte?: number } = {}) => {
    const p: Record<string, string | number> = { page: params.page || 1, sort_by: params.sort_by || "popularity.desc", "vote_count.gte": 100 };
    if (params.genres && params.genres.length > 0) p.with_genres = params.genres.join(",");
    if (params.year) p.first_air_date_year = params.year;
    if (params.vote_average_gte) p["vote_average.gte"] = params.vote_average_gte;
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

export function getTitle(m: MediaItem): string {
  return m.title || m.name || m.original_title || m.original_name || "Untitled";
}

export function getReleaseDate(m: MediaItem): string {
  return m.release_date || m.first_air_date || "";
}

export function getYear(m: MediaItem): string {
  const d = getReleaseDate(m);
  return d ? d.slice(0, 4) : "";
}
