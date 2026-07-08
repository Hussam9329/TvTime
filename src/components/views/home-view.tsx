"use client";

import { useTrending, usePopularMovies, useTopRatedMovies, useUpcomingMovies, usePopularTv, useOnTheAirTv, useTopRatedTv, useWatchlist, useWatchedMovies, useWatchedEpisodes, useFollowing, useStats, useTvDetail } from "@/hooks/use-tmdb";
import { MediaRow } from "@/components/media/media-row";
import { ContinueWatching } from "@/components/media/continue-watching";
import { GenreRecommendations } from "@/components/media/genre-recommendations";
import { Flame, TrendingUp, Star, Calendar, Tv, Clock, Film, Play, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/store";
import { img, getYear, getTitle } from "@/lib/tmdb";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export function HomeView() {
  const trending = useTrending("week", "all");
  const popularMovies = usePopularMovies();
  const topMovies = useTopRatedMovies();
  const upcoming = useUpcomingMovies();
  const popularTv = usePopularTv();
  const onAirTv = useOnTheAirTv();
  const topTv = useTopRatedTv();

  const watchlist = useWatchlist();
  const watchedMovies = useWatchedMovies();
  const following = useFollowing();
  const stats = useStats();

  const setView = useNav((s) => s.setView);
  const userName = useNav((s) => s.userName);

  const heroItem = trending.data?.results?.find((m) => m.backdrop_path && (m.overview?.length || 0) > 100) || trending.data?.results?.[0];

  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    const timer = setTimeout(() => {
      const h = new Date().getHours();
      if (h < 12) setGreeting("Good morning");
      else if (h < 18) setGreeting("Good afternoon");
      else setGreeting("Good evening");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {greeting}, <span className="text-gradient">{userName}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's trending in your cinema world today</p>
        </div>
        {/* Watch Next CTA - shows when user has followed shows */}
        {following.data && following.data.items.length > 0 && (
          <WatchNextCTA />
        )}
      </div>

      {/* Hero featured */}
      {heroItem && <Hero item={heroItem} />}

      {/* Quick stats */}
      {stats.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickStat
            icon={<BookOpen className="w-4 h-4" />}
            label="Watchlist"
            value={stats.data.counts.watchlist}
            onClick={() => setView("library")}
          />
          <QuickStat
            icon={<Film className="w-4 h-4" />}
            label="Movies watched"
            value={stats.data.counts.watchedMovies}
            onClick={() => setView("stats")}
          />
          <QuickStat
            icon={<Tv className="w-4 h-4" />}
            label="Episodes watched"
            value={stats.data.counts.watchedEpisodes}
            onClick={() => setView("stats")}
          />
          <QuickStat
            icon={<Play className="w-4 h-4" />}
            label="Following"
            value={stats.data.counts.following}
            onClick={() => setView("library")}
          />
        </div>
      )}

      {/* Continue watching (followed shows) - only if user has followed shows */}
      {following.data && following.data.items.length > 0 && (
        <ContinueWatching />
      )}

      {/* Your Shows with watch progress */}
      {following.data && following.data.items.length > 0 && (
        <FollowingSection />
      )}

      {/* Recently watched movies */}
      {watchedMovies.data && watchedMovies.data.items.length > 0 && (
        <RecentlyWatched />
      )}

      <MediaRow
        title="Trending Now"
        icon={<Flame className="w-5 h-5" />}
        items={trending.data?.results ?? []}
        loading={trending.isLoading}
      />
      <MediaRow
        title="Popular Movies"
        icon={<TrendingUp className="w-5 h-5" />}
        items={(popularMovies.data?.results ?? []).filter((m) => m.poster_path)}
        loading={popularMovies.isLoading}
        onSeeAll={() => setView("discover")}
      />
      <MediaRow
        title="On The Air"
        icon={<Tv className="w-5 h-5" />}
        items={(onAirTv.data?.results ?? []).filter((m) => m.poster_path)}
        loading={onAirTv.isLoading}
      />
      <MediaRow
        title="Popular TV Shows"
        icon={<Tv className="w-5 h-5" />}
        items={(popularTv.data?.results ?? []).filter((m) => m.poster_path)}
        loading={popularTv.isLoading}
        onSeeAll={() => setView("discover")}
      />
      <MediaRow
        title="Top Rated Movies"
        icon={<Star className="w-5 h-5" />}
        items={(topMovies.data?.results ?? []).filter((m) => m.poster_path)}
        loading={topMovies.isLoading}
      />
      <MediaRow
        title="Top Rated TV Shows"
        icon={<Star className="w-5 h-5" />}
        items={(topTv.data?.results ?? []).filter((m) => m.poster_path)}
        loading={topTv.isLoading}
      />
      <MediaRow
        title="Upcoming Movies"
        icon={<Calendar className="w-5 h-5" />}
        items={(upcoming.data?.results ?? []).filter((m) => m.poster_path)}
        loading={upcoming.isLoading}
      />

      {/* Genre-based recommendations */}
      <GenreRecommendations />
    </div>
  );
}

function QuickStat({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-xl p-3 sm:p-4 text-left hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-gradient group-hover:scale-105 transition-transform inline-block">
        {value}
      </div>
    </button>
  );
}

function Hero({ item }: { item: any }) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const mediaType = item.media_type === "tv" || !item.title ? "tv" : "movie";
  const [idx, setIdx] = useState(0);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative rounded-2xl overflow-hidden border border-border/50 mb-2"
    >
      <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full">
        <img
          src={img(item.backdrop_path, "original")}
          alt={getTitle(item)}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

        <div className="absolute inset-0 flex items-end p-4 sm:p-8 lg:p-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 backdrop-blur text-primary text-xs font-bold uppercase tracking-wide">
                <Flame className="w-3 h-3" /> Featured
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {mediaType === "movie" ? "Movie" : "TV Show"}
              </span>
              {getYear(item) && <span className="text-xs text-muted-foreground">{getYear(item)}</span>}
              {item.vote_average > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" /> {item.vote_average.toFixed(1)}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground drop-shadow-lg mb-2 sm:mb-4">
              {getTitle(item)}
            </h1>
            <p className="text-sm sm:text-base text-foreground/80 line-clamp-2 sm:line-clamp-3 mb-4 max-w-xl">
              {item.overview}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-9" onClick={() => (mediaType === "movie" ? goMovie(item.id) : goTv(item.id))}>
                <Play className="w-4 h-4 mr-1.5 fill-current" /> View Details
              </Button>
              <Button size="sm" variant="secondary" className="h-9" onClick={() => setView("discover")}>
                <Clock className="w-4 h-4 mr-1.5" /> Browse More
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function FollowingSection() {
  const following = useFollowing();
  const goTv = useNav((s) => s.goTv);
  const items = following.data?.items ?? [];

  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Tv className="w-5 h-5 text-primary" />
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Your Shows</h2>
        <span className="text-xs text-muted-foreground ml-1">({items.length})</span>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((s) => (
          <FollowedShowCard key={s.id} tmdbId={s.tmdbId} title={s.title} posterPath={(s as any).poster || (s as any).posterPath} onClick={() => goTv(s.tmdbId)} />
        ))}
      </div>
    </section>
  );
}

function FollowedShowCard({ tmdbId, title, posterPath, onClick }: { tmdbId: number; title: string; posterPath: string | null; onClick: () => void }) {
  const detail = useTvDetail(tmdbId);
  const watched = useWatchedEpisodes(tmdbId);
  const totalEpisodes = detail.data?.number_of_episodes ?? 0;
  const watchedCount = watched.data?.items.length ?? 0;
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[110px] sm:w-[130px] group"
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 group-hover:border-primary/60 transition-colors">
        {posterPath ? (
          <img src={img(posterPath, "w185")} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs p-2 text-center">{title}</div>
        )}
        {/* Progress overlay at bottom */}
        {totalEpisodes > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-4">
            <div className="flex items-center justify-between text-[9px] text-white/90 mb-0.5">
              <span>{watchedCount}/{totalEpisodes}</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium line-clamp-1">{title}</p>
    </button>
  );
}

function RecentlyWatched() {
  const watchedMovies = useWatchedMovies();
  const goMovie = useNav((s) => s.goMovie);
  const items = (watchedMovies.data?.items ?? []).slice(0, 12);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Recently Watched</h2>
        <span className="text-xs text-muted-foreground ml-1">({items.length})</span>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => goMovie(m.tmdbId)}
            className="flex-shrink-0 w-[110px] sm:w-[130px] group"
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 group-hover:border-primary/60 transition-colors">
              {(m as any).poster || (m as any).posterPath ? (
                <img src={img((m as any).poster || (m as any).posterPath, "w185")} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs p-2 text-center">{m.title}</div>
              )}
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500/90 backdrop-blur flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
            <p className="mt-1.5 text-xs font-medium line-clamp-1">{m.title}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(m.watchedAt).toLocaleDateString()}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function WatchNextCTA() {
  const following = useFollowing();
  const goTv = useNav((s) => s.goTv);
  const firstShow = following.data?.items[0];

  if (!firstShow) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => goTv(firstShow.tmdbId)}
      className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-105"
    >
      <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
        <Play className="w-4 h-4 fill-current" />
      </div>
      <div className="text-left">
        <p className="text-[10px] uppercase tracking-wide font-bold opacity-80">Watch Next</p>
        <p className="text-sm font-bold line-clamp-1 max-w-[180px]">{firstShow.title}</p>
      </div>
    </motion.button>
  );
}
