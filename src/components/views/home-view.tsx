"use client";

import { useFollowing, useHomeFeed, useMediaStates, useRecentlyWatched, useStats, useTvTrackingCounts, useWatchedMovieToggle } from "@/hooks/use-tmdb";
import { MediaRow as BaseMediaRow } from "@/components/media/media-row";
import { GenreRecommendations } from "@/components/media/genre-recommendations";
import { HomeCuratedSections } from "@/components/media/home-curated-sections";
import { ArrowRight, Flame, TrendingUp, Star, Calendar, Tv, Clock, Film, Play, BookOpen, Check, X, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/store";
import { img, imgOrPlaceholder, getYear, getTitle } from "@/lib/tmdb";
import { SafeImage } from "@/components/media/safe-image";
import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect, type ComponentProps } from "react";
import { toast } from "sonner";
import { isArabicMediaItem } from "@/lib/arabic-media";

const MediaRow = (props: ComponentProps<typeof BaseMediaRow>) => <BaseMediaRow {...props} compactCards={false} />;

export function HomeView() {
  const homeFeed = useHomeFeed();

  const stats = useStats();
  const tvTrackingCounts = useTvTrackingCounts("standard");

  const setView = useNav((s) => s.setView);
  const userName = useNav((s) => s.userName);

  const standardTrending = (homeFeed.data?.trending.results ?? []).filter((media) => !isArabicMediaItem(media));
  const popularMovieItems = (homeFeed.data?.popularMovies.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media));
  const onAirTvItems = (homeFeed.data?.onTheAirTv.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media));
  const popularTvItems = (homeFeed.data?.popularTv.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media));
  const topMovieItems = (homeFeed.data?.topRatedMovies.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media));
  const topTvItems = (homeFeed.data?.topRatedTv.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media));
  const upcomingMovieItems = (homeFeed.data?.upcomingMovies.results ?? []).filter((media) => media.poster_path && !isArabicMediaItem(media));
  const homeLibraryStates = useMediaStates([
    ...standardTrending.map((item) => ({ tmdbId: Number(item.id), mediaType: item.media_type === "tv" ? "tv" as const : "movie" as const })),
    ...popularMovieItems.map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })),
    ...onAirTvItems.map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })),
    ...popularTvItems.map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })),
    ...topMovieItems.map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })),
    ...topTvItems.map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })),
    ...upcomingMovieItems.map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })),
  ]);
  const sharedLibraryStateSource = { data: homeLibraryStates.data };
  const heroItem = standardTrending.find((media) => media.backdrop_path && (media.overview?.length || 0) > 100) || standardTrending[0];

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
    <div className="tvtime-home-view space-y-6">
      {/* Hero featured */}
      {heroItem && <Hero item={heroItem} greeting={greeting} userName={userName} />}

      {/* Personal library overview */}
      {stats.data && (
        <section className="tvtime-library-overview" aria-labelledby="library-overview-title">
          <div className="tvtime-library-overview__header">
            <div>
              <p className="tvtime-eyebrow">Library snapshot</p>
              <h2 id="library-overview-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">Your watch universe at a glance</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Jump back into a collection, review your progress, or continue the next episode.</p>
            </div>
            <WatchNextCTA />
          </div>

          <div className="tvtime-stat-grid no-scrollbar">
            <QuickStat
              icon={<BookOpen />}
              label="Movie Watchlist"
              value={stats.data.counts.watchlistMovies ?? 0}
              onClick={() => setView("movies")}
            />
            <QuickStat
              icon={<Film />}
              label="Movies Watched"
              value={stats.data.counts.watchedMovies ?? 0}
              onClick={() => setView("movies")}
            />
            <QuickStat
              icon={<Tv />}
              label="TV Shows"
              value={tvTrackingCounts.data?.counts.all ?? "…"}
              onClick={() => setView("tv-shows")}
            />
            <QuickStat
              icon={<BookOpen />}
              label="Anime Watchlist"
              value={stats.data.counts.watchlistAnime ?? 0}
              onClick={() => setView("anime")}
            />
            <QuickStat
              icon={<Check />}
              label="Anime Watched"
              value={stats.data.counts.watchedAnime ?? 0}
              onClick={() => setView("anime")}
            />
            <QuickStat
              icon={<Languages />}
              label="Arabic Movies"
              value={(stats.data.counts.watchlistArabicMovies ?? 0) + (stats.data.counts.watchedArabicMovies ?? 0)}
              onClick={() => setView("arabic-movies")}
            />
            <QuickStat
              icon={<Languages />}
              label="Arabic TV"
              value={stats.data.counts.followingArabicShows ?? 0}
              onClick={() => setView("arabic-tv")}
            />
            <QuickStat
              icon={<Clock />}
              label="Watch time"
              value={stats.data.watchTime?.totalHours || 0}
              suffix="h"
              onClick={() => setView("stats")}
            />
          </div>
        </section>
      )}

      {/* Recently watched movies and shows */}
      <RecentlyWatched />

      <MediaRow
        title="Trending Now"
        icon={<Flame className="w-5 h-5" />}
        items={standardTrending}
        loading={homeFeed.isLoading}
        libraryStateSource={sharedLibraryStateSource}
      />
      <MediaRow
        title="Popular Movies"
        icon={<TrendingUp className="w-5 h-5" />}
        items={popularMovieItems}
        loading={homeFeed.isLoading}
        onSeeAll={() => setView("discover")}
        libraryStateSource={sharedLibraryStateSource}
      />
      <MediaRow
        title="On The Air"
        icon={<Tv className="w-5 h-5" />}
        items={onAirTvItems}
        loading={homeFeed.isLoading}
        forcedMediaType="tv"
        libraryStateSource={sharedLibraryStateSource}
      />
      <MediaRow
        title="Popular TV Shows"
        icon={<Tv className="w-5 h-5" />}
        items={popularTvItems}
        loading={homeFeed.isLoading}
        onSeeAll={() => setView("discover")}
        forcedMediaType="tv"
        libraryStateSource={sharedLibraryStateSource}
      />
      <MediaRow
        title="Top Rated Movies"
        icon={<Star className="w-5 h-5" />}
        items={topMovieItems}
        loading={homeFeed.isLoading}
        libraryStateSource={sharedLibraryStateSource}
      />
      <MediaRow
        title="Top Rated TV Shows"
        icon={<Star className="w-5 h-5" />}
        items={topTvItems}
        loading={homeFeed.isLoading}
        forcedMediaType="tv"
        libraryStateSource={sharedLibraryStateSource}
      />
      <MediaRow
        title="Upcoming Movies"
        icon={<Calendar className="w-5 h-5" />}
        items={upcomingMovieItems}
        loading={homeFeed.isLoading}
        libraryStateSource={sharedLibraryStateSource}
      />

      {/* Genre-based recommendations */}
      <GenreRecommendations />
      <HomeCuratedSections />
    </div>
  );
}

function QuickStat({ icon, label, value, suffix, onClick }: { icon: React.ReactNode; label: string; value: number | string; suffix?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      data-ui-action="surface"
      onClick={onClick}
      className="tvtime-quick-stat"
      aria-label={`${label}: ${value}${suffix ?? ""}`}
    >
      <span className="tvtime-quick-stat__icon" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="tvtime-quick-stat__label">{label}</span>
        <strong className="tvtime-quick-stat__value tabular-nums">
          {value}
          {suffix && <span>{suffix}</span>}
        </strong>
      </span>
      <ArrowRight className="tvtime-quick-stat__arrow" aria-hidden="true" />
    </button>
  );
}

function Hero({ item, greeting, userName }: { item: any; greeting: string; userName: string }) {
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const setView = useNav((state) => state.setView);
  const mediaType = item.media_type === "tv" || !item.title ? "tv" : "movie";
  const title = getTitle(item);
  const year = getYear(item);
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      data-ui-surface="hero"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.45 }}
      className="tvtime-home-hero relative isolate overflow-hidden"
      aria-label={`Featured ${mediaType === "movie" ? "movie" : "TV show"}: ${title}`}
    >
      <div className="tvtime-home-hero__backdrop absolute inset-0 -z-20">
        <SafeImage
          src={img(item.backdrop_path, "w1280")}
          alt=""
          fill
          variant="backdrop"
          priority
          className="absolute inset-0"
        />
      </div>
      <div className="tvtime-home-hero__scrim absolute inset-0 -z-10" aria-hidden="true" />
      <div className="tvtime-home-hero__glow absolute inset-0 -z-10" aria-hidden="true" />

      <div className="tvtime-home-hero__content relative grid min-h-[430px] items-end gap-8 px-5 py-7 sm:min-h-[500px] sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_210px] lg:items-center lg:px-12 lg:py-12 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="max-w-3xl">
          <p className="tvtime-home-hero__greeting">
            <span className="tvtime-live-dot" aria-hidden="true" />
            {greeting}, {userName}
          </p>

          <div className="tvtime-home-hero__meta" aria-label="Featured title information">
            <span className="tvtime-home-hero__featured"><Flame aria-hidden="true" /> Featured now</span>
            <span>{mediaType === "movie" ? "Movie" : "TV Show"}</span>
            {year && <span>{year}</span>}
            {item.vote_average > 0 && (
              <span className="tvtime-home-hero__rating">
                <Star className="fill-current" aria-hidden="true" /> {item.vote_average.toFixed(1)}
              </span>
            )}
          </div>

          <h1 className="tvtime-home-hero__title">{title}</h1>
          <p className="tvtime-home-hero__overview line-clamp-3">{item.overview}</p>

          <div className="tvtime-home-hero__actions">
            <Button size="lg" onClick={() => (mediaType === "movie" ? goMovie(item.id) : goTv(item.id))}>
              <Play className="fill-current" aria-hidden="true" /> View details
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setView("discover")}>
              Explore catalogue <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        {item.poster_path && (
          <div className="tvtime-home-hero__poster hidden lg:block" aria-hidden="true">
            <div className="relative aspect-[2/3] overflow-hidden rounded-[22px]">
              <SafeImage
                src={imgOrPlaceholder(item.poster_path, "w500")}
                alt=""
                fill
                variant="poster"
                priority
              />
            </div>
            <span>Today&apos;s spotlight</span>
          </div>
        )}
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
      <section className="tvtime-recently-watched tvtime-media-row" role="status" aria-busy="true" aria-label="Loading recently watched titles">
        <span className="sr-only">Loading recently watched titles…</span>
        <div className="tvtime-section-heading" aria-hidden="true">
          <div className="flex items-center gap-3">
            <span className="tvtime-section-heading__icon"><Clock className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Recently Watched</h2><p className="tvtime-section-heading__hint">Your latest viewing activity</p></div>
          </div>
        </div>
        <div className="tvtime-recent-scroller no-scrollbar flex overflow-x-auto" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="tvtime-recent-card flex-shrink-0">
              <div className="aspect-[2/3] rounded-[18px] shimmer" />
              <div className="mt-3 h-3 rounded shimmer" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="tvtime-recently-watched tvtime-media-row">
      <div className="tvtime-section-heading">
        <div className="flex items-center gap-3">
          <span className="tvtime-section-heading__icon" aria-hidden="true"><Clock className="h-5 w-5" /></span>
          <div>
            <div className="flex items-baseline gap-2"><h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Recently Watched</h2><span className="tvtime-section-heading__count tabular-nums">{recently.data?.total ?? items.length}</span></div>
            <p className="tvtime-section-heading__hint">Your latest viewing activity</p>
          </div>
        </div>
      </div>
      <div className="tvtime-recent-scroller no-scrollbar flex overflow-x-auto">
        {items.map((item, index) => (
          <RecentlyWatchedCard key={`${item.kind}-${item.tmdbId ?? item.id}-${item.watchedAt}`} item={item} index={index} onGo={() => handleGo(item)} />
        ))}
      </div>
    </section>
  );
}

function RecentlyWatchedCard({ item, index, onGo }: { item: any; index: number; onGo: () => void }) {
  const unwatchToggle = useWatchedMovieToggle();
  const title = item.title || "Untitled";
  const posterSrc = imgOrPlaceholder(item.posterPath || null, "w342");
  const isMovie = item.kind === "movie";
  const tmdbId = Number(item.tmdbId);
  const detailHref = item.hasProfile && Number.isFinite(tmdbId) && tmdbId > 0
    ? `/${isMovie ? "movie" : "tv"}/${tmdbId}`
    : undefined;

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
      aria-disabled={!item.hasProfile}
      className="tvtime-recent-card group relative flex-shrink-0 cursor-pointer text-left aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      title={title}
    >
      {detailHref && (
        <a
          href={detailHref}
          aria-label={`Open ${title}`}
          className="absolute inset-0 z-10 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onGo();
          }}
        />
      )}
      <div className="tvtime-recent-poster relative aspect-[2/3] overflow-hidden bg-muted transition-[border-color,box-shadow,transform]">
        <SafeImage
          src={posterSrc}
          alt={title}
          fill
          variant="poster"
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index === 0 ? "high" : "auto"}
          className="transition-[opacity,transform] duration-300 group-hover:scale-[1.025] group-hover:opacity-95"
        />
        <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-500/90 backdrop-blur flex items-center gap-1 px-1.5 h-5 text-white pointer-events-none">
          <Check className="h-3 w-3" aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase">{isMovie ? "Movie" : "TV"}</span>
        </div>
        {isMovie && (
          <button
            type="button"
            data-ui-action="icon"
            onClick={handleUnwatch}
            disabled={unwatchToggle.isPending}
            aria-label="Remove from watched"
            title="Remove from watched"
            className="absolute left-1.5 top-1.5 z-20 flex size-8 items-center justify-center rounded-full bg-black/75 text-white/90 opacity-0 backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-2.5 line-clamp-1 text-sm font-semibold">{title}</p>
      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
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
    <button
      type="button"
      data-ui-action="primary"
      onClick={() => setView("watch-next")}
      className="tvtime-watch-next-cta group"
      aria-label={`Continue watching ${firstShow.title}`}
    >
      <span className="tvtime-watch-next-cta__icon" aria-hidden="true">
        <Play className="fill-current" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">Continue watching</span>
        <span className="mt-0.5 block max-w-[220px] truncate text-sm font-bold">{firstShow.title}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}
