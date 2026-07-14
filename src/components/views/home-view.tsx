"use client";

import { useTrending, usePopularMovies, useTopRatedMovies, useUpcomingMovies, usePopularTv, useOnTheAirTv, useTopRatedTv, useFollowing, useStats, useShowProgress, useWatchedMovieToggle, useRecentlyWatched } from "@/hooks/use-tmdb";
import { MediaRow } from "@/components/media/media-row";
import { GenreRecommendations } from "@/components/media/genre-recommendations";
import { Flame, TrendingUp, Star, Calendar, Tv, Clock, Film, Play, BookOpen, Check, X, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/store";
import { img, imgOrPlaceholder, getYear, getTitle } from "@/lib/tmdb";
import { SafeImage } from "@/components/media/safe-image";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { isArabicMediaItem } from "@/lib/arabic-media";

export function HomeView() {
  const trending = useTrending("week", "all");
  const popularMovies = usePopularMovies();
  const topMovies = useTopRatedMovies();
  const upcoming = useUpcomingMovies();
  const popularTv = usePopularTv();
  const onAirTv = useOnTheAirTv();
  const topTv = useTopRatedTv();

  const following = useFollowing();
  const stats = useStats();

  const setView = useNav((s) => s.setView);
  const userName = useNav((s) => s.userName);

  const standardTrending = (trending.data?.results ?? []).filter((media) => !isArabicMediaItem(media));
  const heroItem = standardTrending.find((media) => media.backdrop_path && (media.overview?.length || 0) > 100) || standardTrending[0];

  // Compute greeting directly from current hour — no setTimeout(0) delay
  // that caused a flash from "Good evening" to the correct greeting.
  const [greeting, setGreeting] = useState(() => {
    if (typeof window === "undefined") return "Good evening";
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  });

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
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          <QuickStat
            icon={<BookOpen className="w-4 h-4" />}
            label="Movie Watchlist"
            value={stats.data.counts.watchlistMovies ?? 0}
            onClick={() => setView("movies")}
          />
          <QuickStat
            icon={<Film className="w-4 h-4" />}
            label="Movies Watched"
            value={stats.data.counts.watchedMovies ?? 0}
            onClick={() => setView("movies")}
          />
          <QuickStat
            icon={<Tv className="w-4 h-4" />}
            label="TV Shows"
            value={stats.data.counts.series ?? stats.data.counts.following ?? 0}
            onClick={() => setView("tv-shows")}
          />
          <QuickStat
            icon={<BookOpen className="w-4 h-4" />}
            label="Anime Watchlist"
            value={stats.data.counts.watchlistAnime ?? 0}
            onClick={() => setView("anime")}
          />
          <QuickStat
            icon={<Check className="w-4 h-4" />}
            label="Anime Watched"
            value={stats.data.counts.watchedAnime ?? 0}
            onClick={() => setView("anime")}
          />
          <QuickStat
            icon={<Languages className="w-4 h-4" />}
            label="Arabic Movies"
            value={(stats.data.counts.watchlistArabicMovies ?? 0) + (stats.data.counts.watchedArabicMovies ?? 0)}
            onClick={() => setView("arabic-movies")}
          />
          <QuickStat
            icon={<Languages className="w-4 h-4" />}
            label="Arabic TV"
            value={stats.data.counts.followingArabicShows ?? 0}
            onClick={() => setView("arabic-tv")}
          />
          <QuickStat
            icon={<Clock className="w-4 h-4" />}
            label="Watch time"
            value={stats.data.watchTime?.totalHours || 0}
            suffix="h"
            onClick={() => setView("stats")}
          />
        </div>
      )}

      {/* Recently watched movies and shows */}
      <RecentlyWatched />

      <MediaRow
        title="Trending Now"
        icon={<Flame className="w-5 h-5" />}
        items={standardTrending}
        loading={trending.isLoading}
      />
      <MediaRow
        title="Popular Movies"
        icon={<TrendingUp className="w-5 h-5" />}
        items={(popularMovies.data?.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media))}
        loading={popularMovies.isLoading}
        onSeeAll={() => setView("discover")}
      />
      <MediaRow
        title="On The Air"
        icon={<Tv className="w-5 h-5" />}
        items={(onAirTv.data?.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media))}
        loading={onAirTv.isLoading}
        forcedMediaType="tv"
      />
      <MediaRow
        title="Popular TV Shows"
        icon={<Tv className="w-5 h-5" />}
        items={(popularTv.data?.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media))}
        loading={popularTv.isLoading}
        onSeeAll={() => setView("discover")}
        forcedMediaType="tv"
      />
      <MediaRow
        title="Top Rated Movies"
        icon={<Star className="w-5 h-5" />}
        items={(topMovies.data?.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media))}
        loading={topMovies.isLoading}
      />
      <MediaRow
        title="Top Rated TV Shows"
        icon={<Star className="w-5 h-5" />}
        items={(topTv.data?.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media))}
        loading={topTv.isLoading}
        forcedMediaType="tv"
      />
      <MediaRow
        title="Upcoming Movies"
        icon={<Calendar className="w-5 h-5" />}
        items={(upcoming.data?.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media))}
        loading={upcoming.isLoading}
      />

      {/* Genre-based recommendations */}
      <GenreRecommendations />
    </div>
  );
}

function QuickStat({ icon, label, value, suffix, onClick }: { icon: React.ReactNode; label: string; value: number; suffix?: string; onClick?: () => void }) {
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
        {value}{suffix && <span className="text-sm text-muted-foreground font-normal">{suffix}</span>}
      </div>
    </button>
  );
}

function Hero({ item }: { item: any }) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const mediaType = item.media_type === "tv" || !item.title ? "tv" : "movie";
  

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative rounded-2xl overflow-hidden border border-border/50 mb-2"
    >
      <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full">
        <SafeImage
          src={img(item.backdrop_path, "w1280")}
          alt={getTitle(item)}
          fill
          variant="backdrop"
          priority
          className="absolute inset-0"
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

function RecentlyWatched() {
  const recently = useRecentlyWatched(12);
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const items = recently.data?.items ?? [];

  const handleGo = (item: any) => {
    const tmdbId = Number(item.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0 || !item.hasProfile) {
      toast.error("This recently watched item is missing a valid TMDB profile id.");
      return;
    }
    if (item.kind === "tv") goTv(tmdbId);
    else goMovie(tmdbId);
  };

  if (recently.isLoading) {
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Recently Watched</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex-shrink-0 w-[110px] sm:w-[130px]">
              <div className="aspect-[2/3] shimmer rounded-lg" />
              <div className="h-3 shimmer rounded mt-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Recently Watched</h2>
        <span className="text-xs text-muted-foreground ml-1">({recently.data?.total ?? items.length})</span>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((item) => (
          <RecentlyWatchedCard key={`${item.kind}-${item.tmdbId ?? item.id}-${item.watchedAt}`} item={item} onGo={() => handleGo(item)} />
        ))}
      </div>
    </section>
  );
}

function RecentlyWatchedCard({ item, onGo }: { item: any; onGo: () => void }) {
  const unwatchToggle = useWatchedMovieToggle();
  const title = item.title || "Untitled";
  const posterSrc = imgOrPlaceholder(item.posterPath || null, "w342");
  const isMovie = item.kind === "movie";

  const handleUnwatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isMovie || !item.tmdbId) {
      toast.info(isMovie ? "This movie is missing a valid TMDB id." : "Episode unwatching is handled from the TV profile.");
      return;
    }
    unwatchToggle.mutate(
      {
        action: "remove",
        tmdbId: Number(item.tmdbId),
        title,
        posterPath: item.posterPath,
      },
      {
        onSuccess: () => {
          toast.success(`Removed "${title}" from watched`);
        },
        onError: () => {
          toast.error("Failed to unwatch");
        },
      }
    );
  };

  return (
    <div
      role="button"
      tabIndex={item.hasProfile ? 0 : -1}
      aria-disabled={!item.hasProfile}
      onClick={item.hasProfile ? onGo : undefined}
      onKeyDown={(event) => {
        if (item.hasProfile && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onGo();
        }
      }}
      className="flex-shrink-0 w-[110px] sm:w-[130px] group cursor-pointer relative text-left aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      title={title}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 group-hover:border-primary/60 transition-colors">
        <SafeImage
          src={posterSrc}
          alt={title}
          fill
          variant="poster"
          loading="lazy"
          decoding="async"
          className="group-hover:scale-105 transition-transform"
        />
        <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-500/90 backdrop-blur flex items-center gap-1 px-1.5 h-5 text-white pointer-events-none">
          <Check className="w-3 h-3" />
          <span className="text-[9px] font-bold uppercase">{isMovie ? "Movie" : "TV"}</span>
        </div>
        {isMovie && (
          <button
            type="button"
            onClick={handleUnwatch}
            disabled={unwatchToggle.isPending}
            aria-label="Remove from watched"
            title="Remove from watched"
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-white/90 hover:bg-rose-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium line-clamp-1">{title}</p>
      <p className="text-[10px] text-muted-foreground line-clamp-1">
        {item.subtitle ? `${item.subtitle} • ` : ""}{item.watchedAt ? new Date(item.watchedAt).toLocaleDateString() : "—"}
      </p>
    </div>
  );
}

function WatchNextCTA() {
  const following = useFollowing();
  const setView = useNav((s) => s.setView);
  const firstShow = following.data?.items[0];

  if (!firstShow) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => setView("tv-shows")}
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
