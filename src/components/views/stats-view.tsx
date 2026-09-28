"use client";

import { useStats, useTvDetail } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { Film, Tv, Clock, Star, BookOpen, Bell, TrendingUp, Trophy, Languages, CalendarDays, Layers3 } from "lucide-react";
import { img } from "@/lib/tmdb";
import { useNav } from "@/lib/store";
import { SafeImage } from "@/components/media/safe-image";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

// Chart series follow the theme chart tokens so they stay on-brand in both themes.
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const CHART_TOOLTIP_STYLE = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 12,
};

export function StatsView() {
  const stats = useStats();
  const { goTv, setView } = useNav();

  if (stats.isLoading) {
    return (
      <div className="tvtime-stats-page space-y-5" aria-busy="true">
        <PageTitlebar title="Your Statistics" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 shimmer rounded-2xl" />)}
        </div>
        <div className="h-32 shimmer rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 shimmer rounded-2xl lg:col-span-2" />
          <div className="h-72 shimmer rounded-2xl" />
          <div className="h-72 shimmer rounded-2xl" />
        </div>
      </div>
    );
  }

  const d = stats.data;
  if (stats.isError || !d) {
    return (
      <div className="tvtime-stats-page space-y-5">
        <PageTitlebar title="Your Statistics" />
        <Card>
          <ErrorState
            title="Couldn’t load your statistics"
            description="Your collection is safe. The statistics service didn’t respond — try again in a moment."
            onRetry={() => void stats.refetch()}
          />
        </Card>
      </div>
    );
  }

  const counts = d.counts;
  const wt = d.watchTime || { totalMinutes: 0, totalHours: 0, movieMinutes: 0, episodeMinutes: 0 };

  // top shows by episode count
  const topShows = (d.episodesByShow ?? []).slice(0, 5);

  return (
    <div className="tvtime-stats-page space-y-5">
      <PageTitlebar title="Your Statistics" />

      {/* Big numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BigStat icon={<Film className="w-5 h-5" />} label="All movies watched" value={counts.watchedMoviesAll ?? counts.watchedMovies} color="from-primary/20 to-primary/5" />
        <BigStat icon={<Tv className="w-5 h-5" />} label="Episodes watched" value={counts.watchedEpisodes} color="from-chart-2/20 to-chart-2/5" />
        <BigStat icon={<Bell className="w-5 h-5" />} label="TV shows following" value={counts.following} color="from-chart-4/20 to-chart-4/5" />
        <BigStat icon={<Languages className="w-5 h-5" />} label="Arabic movies" value={counts.arabicMovies ?? (counts.watchedArabicMovies ?? 0) + (counts.watchlistArabicMovies ?? 0)} color="from-chart-3/20 to-chart-3/5" />
        <BigStat icon={<Languages className="w-5 h-5" />} label="Arabic TV following" value={counts.followingArabicShows ?? 0} color="from-chart-4/15 to-chart-4/5" />
        <BigStat icon={<BookOpen className="w-5 h-5" />} label="All watchlists" value={counts.watchlist} color="from-chart-5/20 to-chart-5/5" />
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
              <span className="whitespace-nowrap">≈ {Math.floor(wt.totalHours / 24)} days</span>
              {" · "}
              <span className="whitespace-nowrap">{wt.movieMinutes} min from movies</span>
              {" + "}
              <span className="whitespace-nowrap">{wt.episodeMinutes} min from episodes</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 bg-gradient-to-br from-primary/15 to-transparent"><p className="text-xs text-muted-foreground flex items-center gap-1.5"><Star className="h-4 w-4 text-primary" /> Most watched genre</p><p className="mt-2 text-2xl font-black">{d.insights?.topGenres?.[0]?.genre ?? "—"}</p><p className="text-xs text-muted-foreground">{d.insights?.topGenres?.[0]?.percentage ?? 0}% of your genre profile · {d.insights?.topGenres?.[0]?.count ?? 0} titles</p></Card>
        <Card className="p-4 bg-gradient-to-br from-chart-4/15 to-transparent"><p className="text-xs text-muted-foreground flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" /> Best release year</p><p className="mt-2 text-2xl font-black">{d.insights?.bestYear?.year ?? "—"}</p><p className="text-xs text-muted-foreground">{d.insights?.bestYear?.count ?? 0} watched titles</p></Card>
        <Card className="p-4 bg-gradient-to-br from-chart-2/15 to-transparent"><p className="text-xs text-muted-foreground flex items-center gap-1.5"><Layers3 className="h-4 w-4 text-chart-2" /> Longest show</p><p className="mt-2 line-clamp-1 text-xl font-black">{d.insights?.longestShow?.title ?? "—"}</p><p className="text-xs text-muted-foreground">{d.insights?.longestShow?.episodes ?? 0} episodes</p></Card>
      </div>

      {d.genreDistribution?.items && d.genreDistribution.items.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-bold">Your genre profile</h3>
              <p className="text-xs text-muted-foreground">Real distribution across the genres attached to titles you watch or actively track.</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Genre coverage: {d.genreDistribution.coveragePercentage}%</span>
          </div>
          <div className="space-y-2.5">
            {d.genreDistribution.items.slice(0, 8).map((item) => (
              <div key={item.genre} className="tvtime-genre-distribution-row grid items-center gap-2 text-xs">
                <span className="truncate font-medium">{item.genre}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-to-r from-primary to-chart-2" style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">{item.percentage}% · {item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

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
                    { name: "Standard movies watched", value: counts.watchedMovies },
                    { name: "TV shows following", value: counts.following },
                    { name: "Watchlist movies", value: counts.watchlistMovies },
                    { name: "Watchlist shows", value: counts.watchlistShows },
                    { name: "Anime watched", value: counts.watchedAnime },
                    { name: "Anime watchlist", value: counts.watchlistAnime },
                    { name: "Arabic movies", value: counts.arabicMovies ?? (counts.watchedArabicMovies ?? 0) + (counts.watchlistArabicMovies ?? 0) },
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
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="value" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Ratings" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState className="h-56 py-0" icon={<Star className="size-8" />} title="No ratings yet" description="Rate titles you’ve watched to see your distribution here." />
          )}
          <p className="text-center text-sm text-muted-foreground mt-2">
            Average: <span className="text-primary font-bold">{d.avgRating ? d.avgRating.toFixed(1) : "—"}</span> / 100
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
      {(counts.watchedMoviesAll ?? counts.watchedMovies) === 0 && counts.watchedEpisodes === 0 && counts.watchlist === 0 && counts.following === 0 && (
        <Card>
          <EmptyState
            icon={<Film className="size-8" />}
            title="You haven’t tracked anything yet"
            description="Add movies and shows to your collection and your statistics will appear here."
            action={<Button type="button" onClick={() => setView("discover")}>Go to Discover</Button>}
          />
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
    return <EmptyState className="h-56 py-0" icon={<TrendingUp className="size-8" />} title="No activity yet" description="Mark movies or episodes as watched to build your monthly timeline." />;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Movies" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Episodes" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
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
    <button type="button"
      data-ui-action="surface"
      onClick={() => onGo(showId)}
      aria-label={`Open ${title}`}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left group"
    >
      <span className="size-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{rank}</span>
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
          <div className="h-full bg-gradient-to-r from-primary to-chart-2 transition-[width] duration-300" style={{ width: `${(count / max) * 100}%` }} />
        </div>
      </div>
    </button>
  );
}
