"use client";

import { useStats, useWatchedMovies, useWatchedEpisodes, useFollowing, useWatchlist, useRatings, useTvDetail } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { Film, Tv, Clock, Star, BookOpen, Bell, TrendingUp, Trophy, BarChart3, Languages } from "lucide-react";
import { img } from "@/lib/tmdb";
import { useNav } from "@/lib/store";
import { SafeImage } from "@/components/media/safe-image";

const PIE_COLORS = ["oklch(0.62 0.23 16)", "oklch(0.65 0.18 320)", "oklch(0.7 0.15 180)", "oklch(0.72 0.18 80)", "oklch(0.6 0.2 260)"];

export function StatsView() {
  const stats = useStats();
  const { goMovie, goTv, setView } = useNav();
  const userName = useNav((s) => s.userName);

  if (stats.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 shimmer rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  const d = stats.data;
  if (!d) return null;

  const counts = d.counts;
  const wt = d.watchTime || { totalMinutes: 0, totalHours: 0, movieMinutes: 0, episodeMinutes: 0 };

  // top shows by episode count
  const topShows = (d.episodesByShow ?? []).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Your Statistics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, <span className="text-foreground font-medium">{userName}</span></p>
        </div>
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BigStat icon={<Film className="w-5 h-5" />} label="Movies watched" value={counts.watchedMovies} color="from-rose-500/20 to-rose-500/5" />
        <BigStat icon={<Tv className="w-5 h-5" />} label="Episodes watched" value={counts.watchedEpisodes} color="from-purple-500/20 to-purple-500/5" />
        <BigStat icon={<Bell className="w-5 h-5" />} label="TV shows following" value={counts.following} color="from-amber-500/20 to-amber-500/5" />
        <BigStat icon={<Languages className="w-5 h-5" />} label="Arabic movies" value={(counts.watchedArabicMovies ?? 0) + (counts.watchlistArabicMovies ?? 0)} color="from-emerald-500/20 to-emerald-500/5" />
        <BigStat icon={<Languages className="w-5 h-5" />} label="Arabic TV following" value={counts.followingArabicShows ?? 0} color="from-orange-500/20 to-orange-500/5" />
        <BigStat icon={<BookOpen className="w-5 h-5" />} label="All watchlists" value={counts.watchlist} color="from-cyan-500/20 to-cyan-500/5" />
      </div>

      {/* Watch time hero */}
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total watch time</p>
            <p className="text-3xl sm:text-4xl font-extrabold text-gradient">
              {wt.totalHours} <span className="text-lg text-muted-foreground font-normal">hours</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ≈ {Math.floor(wt.totalHours / 24)} days · {wt.movieMinutes} min from movies + {wt.episodeMinutes} min from episodes
            </p>
          </div>
        </div>
      </Card>

      {/* Grid of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity by month (combined) */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Watching activity by month</h3>
          <ActivityChart movies={d.moviesByMonth ?? []} episodes={d.episodesByMonth ?? []} />
        </Card>

        {/* Collection breakdown */}
        <Card className="p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Collection breakdown</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Movies watched", value: counts.watchedMovies },
                    { name: "TV shows following", value: counts.following },
                    { name: "Watchlist movies", value: counts.watchlistMovies },
                    { name: "Watchlist shows", value: counts.watchlistShows },
                    { name: "Anime watched", value: counts.watchedAnime },
                    { name: "Anime watchlist", value: counts.watchlistAnime },
                    { name: "Arabic movies", value: (counts.watchedArabicMovies ?? 0) + (counts.watchlistArabicMovies ?? 0) },
                    { name: "Arabic TV", value: counts.followingArabicShows ?? 0 },
                  ].filter((x) => x.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.21 0.025 280)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Rating distribution */}
        <Card className="p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Your rating distribution</h3>
          {d.ratingDist && d.ratingDist.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.ratingDist} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                  <XAxis dataKey="value" stroke="oklch(0.68 0.02 280)" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="oklch(0.68 0.02 280)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.21 0.025 280)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                  <Bar dataKey="count" name="Ratings" fill="oklch(0.62 0.23 16)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No ratings yet</div>
          )}
          <p className="text-center text-sm text-muted-foreground mt-2">
            Average: <span className="text-amber-400 font-bold">{d.avgRating ? d.avgRating.toFixed(1) : "—"}</span> / 100
          </p>
        </Card>
      </div>

      {/* Top shows */}
      {topShows.length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Most watched shows</h3>
          <TopShowsList items={topShows} onGo={(id) => goTv(id)} />
        </Card>
      )}

      {/* Empty state CTA */}
      {counts.watchedMovies === 0 && counts.watchedEpisodes === 0 && counts.watchlist === 0 && counts.following === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">You haven't tracked anything yet. Start exploring!</p>
          <button onClick={() => setView("discover")} className="text-primary font-semibold underline">Go to Discover →</button>
        </Card>
      )}
    </div>
  );
}

function BigStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className={`p-4 relative overflow-hidden bg-gradient-to-br ${color}`}>
      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-background/50 backdrop-blur flex items-center justify-center text-primary mb-2">{icon}</div>
        <p className="text-2xl sm:text-3xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function ActivityChart({ movies, episodes }: { movies: { month: string; count: number }[]; episodes: { month: string; count: number }[] }) {
  // Merge by month key
  const map = new Map<string, { movies: number; episodes: number }>();
  for (const m of movies) map.set(m.month, { movies: m.count, episodes: 0 });
  for (const e of episodes) {
    const cur = map.get(e.month) || { movies: 0, episodes: 0 };
    cur.episodes = e.count;
    map.set(e.month, cur);
  }
  const data = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, v]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      Movies: v.movies,
      Episodes: v.episodes,
    }));

  if (data.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No activity yet — start watching!</div>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
          <XAxis dataKey="month" stroke="oklch(0.68 0.02 280)" fontSize={11} />
          <YAxis allowDecimals={false} stroke="oklch(0.68 0.02 280)" fontSize={11} />
          <Tooltip contentStyle={{ background: "oklch(0.21 0.025 280)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Movies" stackId="a" fill="oklch(0.62 0.23 16)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Episodes" stackId="a" fill="oklch(0.65 0.18 320)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopShowsList({ items, onGo }: { items: { showId: number; count: number }[]; onGo: (id: number) => void }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <TopShowRow key={s.showId} showId={s.showId} count={s.count} rank={i + 1} max={max} onGo={onGo} />
      ))}
    </div>
  );
}

function TopShowRow({ showId, count, rank, max, onGo }: { showId: number; count: number; rank: number; max: number; onGo: (id: number) => void }) {
  const detail = useTvDetail(showId);
  const title = detail.data?.name || `Show #${showId}`;
  const poster = detail.data?.poster_path;

  return (
    <button
      onClick={() => onGo(showId)}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left group"
    >
      <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{rank}</span>
      <div className="relative w-10 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {poster ? (
          <SafeImage src={img(poster, "w92")} alt={title} fill variant="poster" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Tv className="w-4 h-4" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{title}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{count} ep</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all" style={{ width: `${(count / max) * 100}%` }} />
        </div>
      </div>
    </button>
  );
}
