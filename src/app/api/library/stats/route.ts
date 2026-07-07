import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - aggregate stats for the user
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);

  const [watchedMovies, watchedEpisodes, watchlist, following, ratings] = await Promise.all([
    db.watchedMovie.findMany({ where: { userId: user.id } }),
    db.watchedEpisode.findMany({ where: { userId: user.id } }),
    db.watchlistItem.findMany({ where: { userId: user.id } }),
    db.followingShow.findMany({ where: { userId: user.id } }),
    db.rating.findMany({ where: { userId: user.id } }),
  ]);

  // Compute unique shows watched
  const showsWatched = new Set(watchedEpisodes.map((e) => e.showId));

  // Total watch time (movies runtime + episodes * 45min estimate)
  const movieMinutes = watchedMovies.reduce((s, m) => s + (m.runtime || 0), 0);
  const episodeMinutes = watchedEpisodes.length * 45;
  const totalMinutes = movieMinutes + episodeMinutes;

  // Group episodes by show
  const episodesByShow = new Map<number, number>();
  for (const e of watchedEpisodes) {
    episodesByShow.set(e.showId, (episodesByShow.get(e.showId) || 0) + 1);
  }

  // Group watched movies by year (based on watchedAt)
  const moviesByMonth = new Map<string, number>();
  for (const m of watchedMovies) {
    const key = m.watchedAt.toISOString().slice(0, 7); // YYYY-MM
    moviesByMonth.set(key, (moviesByMonth.get(key) || 0) + 1);
  }
  const episodesByMonth = new Map<string, number>();
  for (const e of watchedEpisodes) {
    const key = e.watchedAt.toISOString().slice(0, 7);
    episodesByMonth.set(key, (episodesByMonth.get(key) || 0) + 1);
  }

  // Average rating
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.value, 0) / ratings.length : 0;

  // Rating distribution
  const ratingDist = new Map<number, number>();
  for (const r of ratings) {
    ratingDist.set(r.value, (ratingDist.get(r.value) || 0) + 1);
  }

  // Watchlist by type
  const watchlistMovies = watchlist.filter((w) => w.mediaType === "movie").length;
  const watchlistShows = watchlist.filter((w) => w.mediaType === "tv").length;

  return NextResponse.json({
    user,
    counts: {
      watchedMovies: watchedMovies.length,
      watchedEpisodes: watchedEpisodes.length,
      showsWatched: showsWatched.size,
      watchlist: watchlist.length,
      watchlistMovies,
      watchlistShows,
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
    moviesByMonth: Array.from(moviesByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    episodesByMonth: Array.from(episodesByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    avgRating,
    ratingDist: Array.from(ratingDist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, count })),
  });
}
