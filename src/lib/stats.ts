import type { MediaItem, WatchSession, Stats } from "./types";

// ─────────────────────────────────────────────────────────────
// Compute comprehensive stats from media + watch sessions
// ─────────────────────────────────────────────────────────────

const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function computeStats(media: MediaItem[], sessions: WatchSession[]): Stats {
  const movies = media.filter((m) => m.mediaType === "movie" && m.status === "completed");
  const arabicMovies = media.filter((m) => m.mediaType === "arabic_movie" && m.status === "completed");
  const shows = media.filter((m) => m.mediaType === "tv");
  const anime = media.filter((m) => m.mediaType === "anime");
  const arabicTV = media.filter((m) => m.mediaType === "arabic_tv");

  // Total episodes = sum of progress for tv/anime/arabic_tv
  const totalEpisodes =
    [...shows, ...anime, ...arabicTV].reduce((sum, m) => sum + (m.progress || 0), 0);

  const totalWatchTimeMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  // Average rating
  const rated = media.filter((m) => m.userRating !== undefined);
  const averageRating = rated.length
    ? rated.reduce((sum, m) => sum + (m.userRating || 0), 0) / rated.length
    : 0;

  // Most watched genre
  const genreCounts = new Map<string, number>();
  sessions.forEach((s) => {
    const m = media.find((mm) => mm.tmdbId === s.tmdbId && mm.mediaType === s.mediaType);
    if (m) {
      m.genres.forEach((g) => {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });
    }
  });
  const genreEntries = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]);
  const mostWatchedGenre = genreEntries[0] ? { genre: genreEntries[0][0], count: genreEntries[0][1] } : undefined;

  // Most used platform
  const platformMinutes = new Map<string, number>();
  sessions.forEach((s) => {
    if (s.source) {
      platformMinutes.set(s.source, (platformMinutes.get(s.source) || 0) + (s.duration || 0));
    }
  });
  const platformEntries = Array.from(platformMinutes.entries()).sort((a, b) => b[1] - a[1]);
  const mostUsedPlatform = platformEntries[0] ? { platform: platformEntries[0][0], minutes: platformEntries[0][1] } : undefined;

  // Most watched country (Arabic content has country)
  const countryCounts = new Map<string, number>();
  sessions.forEach((s) => {
    const m = media.find((mm) => mm.tmdbId === s.tmdbId && mm.mediaType === s.mediaType);
    if (m?.country) {
      countryCounts.set(m.country, (countryCounts.get(m.country) || 0) + 1);
    }
  });
  const countryEntries = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const mostWatchedCountry = countryEntries[0] ? { country: countryEntries[0][0], count: countryEntries[0][1] } : undefined;

  // Most watched language
  const languageCounts = new Map<string, number>();
  sessions.forEach((s) => {
    const m = media.find((mm) => mm.tmdbId === s.tmdbId && mm.mediaType === s.mediaType);
    if (m?.originalLanguage) {
      languageCounts.set(m.originalLanguage, (languageCounts.get(m.originalLanguage) || 0) + 1);
    }
  });
  const languageEntries = Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1]);
  const mostWatchedLanguage = languageEntries[0] ? { language: languageEntries[0][0], count: languageEntries[0][1] } : undefined;

  // Weekday activity
  const weekdayMinutes = new Array(7).fill(0);
  sessions.forEach((s) => {
    const day = new Date(s.watchedAt).getDay();
    weekdayMinutes[day] += s.duration || 0;
  });
  const weekdayActivity = WEEKDAYS_AR.map((day, i) => ({ day, minutes: Math.round(weekdayMinutes[i]) }));

  // Hourly activity
  const hourlyMinutes = new Array(24).fill(0);
  sessions.forEach((s) => {
    const h = new Date(s.watchedAt).getHours();
    hourlyMinutes[h] += s.duration || 0;
  });
  const hourlyActivity = hourlyMinutes.map((minutes, hour) => ({ hour, minutes: Math.round(minutes) }));

  // Monthly activity (last 12 months)
  const monthlyActivity = MONTHS.map((month, i) => {
    const minutes = sessions
      .filter((s) => {
        const d = new Date(s.watchedAt);
        return d.getMonth() === i;
      })
      .reduce((sum, s) => sum + (s.duration || 0), 0);
    return { month, minutes: Math.round(minutes) };
  });

  // Streaks (consecutive days with at least one session)
  const sessionDays = new Set(sessions.map((s) => s.watchedAt.slice(0, 10)));
  const sortedDays = Array.from(sessionDays).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.round(diff) === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  // Current streak: count back from today
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (sessionDays.has(d.toISOString().slice(0, 10))) {
      currentStreak++;
    } else if (i > 0) {
      break;
    }
  }

  // Rewatch count
  const rewatchCount = media.reduce((sum, m) => sum + (m.rewatchCount || 0), 0);

  // Completion rate
  const total = media.length;
  const completed = media.filter((m) => m.status === "completed").length;
  const dropped = media.filter((m) => m.status === "dropped").length;
  const completionRate = total ? completed / total : 0;
  const abandonedRate = total ? dropped / total : 0;

  // Rating distribution (1-10 buckets)
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: media.filter((m) => {
      const r = m.userRating || 0;
      return r >= (i + 1) * 10 && r < (i + 2) * 10;
    }).length,
  }));

  // Top shows by episodes watched
  const topShows = [...shows, ...anime, ...arabicTV]
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
    .slice(0, 5)
    .map((m) => ({
      title: m.title,
      episodesWatched: m.progress || 0,
      posterPath: m.posterPath,
    }));

  // Genre breakdown (for chart)
  const genreBreakdown = genreEntries.slice(0, 8).map(([genre, count]) => ({ genre, count }));

  // Year over year
  const currentYear = today.getFullYear();
  const yearOverYear = [currentYear - 2, currentYear - 1, currentYear].map((year) => {
    const yearSessions = sessions.filter((s) => new Date(s.watchedAt).getFullYear() === year);
    return {
      year,
      movies: yearSessions.filter((s) => s.mediaType === "movie" || s.mediaType === "arabic_movie").length,
      episodes: yearSessions.filter((s) => s.mediaType === "tv" || s.mediaType === "anime" || s.mediaType === "arabic_tv").length,
      minutes: yearSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
    };
  });

  // Watchlist burden
  const watchlistItems = media.filter((m) => m.status === "watchlist" || m.status === "plan_to_watch");
  const estimatedMinutes = watchlistItems.reduce((sum, m) => {
    if (m.mediaType === "movie" || m.mediaType === "arabic_movie") {
      return sum + (m.runtime || 120);
    }
    return sum + (m.totalEpisodes || 0) * (m.runtime || 45);
  }, 0);
  const monthlyMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 6;
  const monthsToFinish = monthlyMinutes > 0 ? Math.ceil(estimatedMinutes / monthlyMinutes) : 0;

  return {
    totalMovies: movies.length + arabicMovies.length,
    totalEpisodes,
    totalShows: shows.length,
    totalAnime: anime.length,
    totalArabicMovies: arabicMovies.length,
    totalArabicTV: arabicTV.length,
    totalWatchTimeMinutes,
    averageRating,
    mostWatchedGenre,
    mostUsedPlatform,
    mostWatchedCountry,
    mostWatchedLanguage,
    weekdayActivity,
    hourlyActivity,
    monthlyActivity,
    currentStreak,
    longestStreak,
    rewatchCount,
    completionRate,
    abandonedRate,
    ratingDistribution,
    topShows,
    genreBreakdown,
    yearOverYear,
    watchlistBurden: {
      totalItems: watchlistItems.length,
      estimatedMinutes,
      monthsToFinish,
    },
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} دقيقة`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} ساعة`;
  const days = hours / 24;
  return `${days.toFixed(1)} يوم`;
}

export function formatWatchTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days} يوم و ${hours % 24} ساعة`;
  }
  return `${hours} ساعة و ${Math.round(minutes % 60)} دقيقة`;
}
