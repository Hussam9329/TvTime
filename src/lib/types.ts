// Types for the TvTime-like tracking system

export type MediaType =
  | "movie"
  | "tv"
  | "anime"
  | "arabic_movie"
  | "arabic_tv";

export type MediaStatus =
  | "watchlist"
  | "plan_to_watch"
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped";

export type AnimeStatus =
  | "watchlist"
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped";

export interface Episode {
  id: string;
  season: number;
  episode: number;
  name: string;
  overview?: string;
  stillPath?: string;
  airDate?: string; // YYYY-MM-DD
  runtime?: number;
  watched: boolean;
  watchedAt?: string;
  userRating?: number;
}

export interface MediaItem {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  runtime?: number;
  genres: string[];
  voteAverage?: number;
  voteCount?: number;
  status: MediaStatus;
  progress: number;
  totalEpisodes?: number;
  currentSeason?: number;
  currentEpisode?: number;
  userRating?: number;
  favorite: boolean;
  rewatchCount: number;
  notes?: string;
  tags?: string[];
  lastWatchedAt?: string;
  addedAt: string;
  // For TV/Anime
  seasons?: Season[];
  // For schedule
  nextEpisode?: NextEpisode;
  // For movies: where to watch
  providers?: string[];
  // Country/language for Arabic content
  country?: string;
  originalLanguage?: string;
}

export interface Season {
  season: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
  overview?: string;
}

export interface NextEpisode {
  season: number;
  episode: number;
  name?: string;
  airDate: string;
  runtime?: number;
}

export interface WatchSession {
  id: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  season?: number;
  episode?: number;
  watchedAt: string;
  duration?: number;
  rewatch: boolean;
  rating?: number;
  source?: string;
}

export interface CalendarEntry {
  date: string; // YYYY-MM-DD
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string;
  season: number;
  episode: number;
  name?: string;
  runtime?: number;
  watched: boolean;
}

export interface Notification {
  id: string;
  type: "new_episode" | "movie_available" | "season_return" | "backlog_alert";
  title: string;
  body: string;
  tmdbId?: number;
  mediaType?: MediaType;
  read: boolean;
  createdAt: string;
  scheduledFor?: string;
}

export interface UserSettings {
  country: string;
  timezone: string;
  preferredPlatforms: string[];
  theme: "light" | "dark";
  notificationsEnabled: boolean;
  episodeAlerts: boolean;
  movieAlerts: boolean;
}

export interface CustomList {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  color: string;
  items: CustomListItem[];
  createdAt: string;
}

export interface CustomListItem {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string;
  addedAt: string;
}

export interface SearchFilters {
  query: string;
  types: MediaType[]; // multi-select
  genres: string[];
  yearFrom?: number;
  yearTo?: number;
  ratingFrom?: number; // 0-10
  ratingTo?: number;
  status?: MediaStatus; // library status filter
  inLibraryOnly?: boolean;
  sortBy: "relevance" | "popularity" | "rating" | "newest" | "oldest";
  country?: string;
  language?: string;
}

export interface Stats {
  totalMovies: number;
  totalEpisodes: number;
  totalShows: number;
  totalAnime: number;
  totalArabicMovies: number;
  totalArabicTV: number;
  totalWatchTimeMinutes: number;
  averageRating: number;
  // Personal deep analysis
  mostWatchedGenre?: { genre: string; count: number };
  mostWatchedActor?: { name: string; count: number };
  mostWatchedDirector?: { name: string; count: number };
  mostUsedPlatform?: { platform: string; minutes: number };
  mostWatchedCountry?: { country: string; count: number };
  mostWatchedLanguage?: { language: string; count: number };
  weekdayActivity: { day: string; minutes: number }[]; // 7 entries
  hourlyActivity: { hour: number; minutes: number }[]; // 24 entries
  currentStreak: number;
  longestStreak: number;
  rewatchCount: number;
  completionRate: number; // 0-1
  abandonedRate: number; // 0-1
  monthlyActivity: { month: string; minutes: number }[]; // 12 entries
  ratingDistribution: { rating: number; count: number }[]; // 1-10 buckets
  topShows: { title: string; episodesWatched: number; posterPath?: string }[];
  genreBreakdown: { genre: string; count: number }[];
  // Year over year
  yearOverYear: { year: number; movies: number; episodes: number; minutes: number }[];
  // Watchlist burden
  watchlistBurden: {
    totalItems: number;
    estimatedMinutes: number;
    monthsToFinish: number; // at current pace
  };
}
