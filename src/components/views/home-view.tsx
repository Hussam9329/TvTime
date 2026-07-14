"use client";

import { useTrending, usePopularMovies, useTopRatedMovies, useUpcomingMovies, usePopularTv, useOnTheAirTv, useTopRatedTv, useFollowing, useStats, useShowProgress, useWatchedMovieToggle, useRecentlyWatched } from "@/hooks/use-tmdb";
import { MediaRow } from "@/components/media/media-row";
import { GenreRecommendations } from "@/components/media/genre-recommendations";
import { ContinueWatchingSlides } from "@/components/media/continue-watching-slides";
import { Flame, TrendingUp, Star, Calendar, Tv, Clock, Film, Play, BookOpen, Check, X, Languages, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/store";
import { img, imgOrPlaceholder, getYear, getTitle } from "@/lib/tmdb";
import { SafeImage } from "@/components/media/safe-image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
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

  // Build Featured slides: one from each watched category + trending
  const recently = useRecentlyWatched(50);
  const featuredSlides = buildFeaturedSlides(standardTrending, recently.data?.items ?? []);

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

      {/* Hero featured — rotating carousel from watched + trending */}
      {featuredSlides.length > 0 && <FeaturedCarousel slides={featuredSlides} />}

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

      {/* Continue Watching — one slide per category (movie, TV, anime, Arabic) */}
      <ContinueWatchingSlides />

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
// ── Featured Carousel ────────────────────────────────────────────────────
type FeaturedSlide = {
  id: number;
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  year: string;
  voteAverage: number;
  mediaType: "movie" | "tv";
  badge: string;
  badgeIcon: React.ElementType;
  badgeColor: string;
};

const CATEGORY_BADGE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  trending: { label: "Trending", icon: Flame, color: "bg-primary/20 text-primary" },
  movie: { label: "Last Movie Watched", icon: Film, color: "bg-blue-500/20 text-blue-400" },
  tv: { label: "Last TV Watched", icon: Tv, color: "bg-purple-500/20 text-purple-400" },
  anime: { label: "Last Anime Watched", icon: Sparkles, color: "bg-fuchsia-500/20 text-fuchsia-400" },
  "arabic-movie": { label: "آخر فيلم عربي", icon: Film, color: "bg-emerald-500/20 text-emerald-400" },
  "arabic-tv": { label: "آخر مسلسل عربي", icon: Tv, color: "bg-amber-500/20 text-amber-400" },
};

function buildFeaturedSlides(trending: any[], recentlyItems: any[]): FeaturedSlide[] {
  const slides: FeaturedSlide[] = [];
  const seenIds = new Set<number>();

  // 1. Trending
  const trendingItem = trending.find((m) => m.backdrop_path && (m.overview?.length || 0) > 80);
  if (trendingItem) {
    const isTv = trendingItem.media_type === "tv" || !trendingItem.title;
    slides.push({
      id: trendingItem.id,
      title: getTitle(trendingItem),
      overview: trendingItem.overview || "",
      backdropPath: trendingItem.backdrop_path,
      posterPath: trendingItem.poster_path,
      year: getYear(trendingItem),
      voteAverage: trendingItem.vote_average || 0,
      mediaType: isTv ? "tv" : "movie",
      badge: "Trending",
      badgeIcon: Flame,
      badgeColor: "bg-primary/20 text-primary",
    });
    seenIds.add(trendingItem.id);
  }

  // 2. One per recently-watched category
  const seenCats = new Set<string>();
  for (const item of recentlyItems) {
    const cat = item.category;
    if (!cat || seenCats.has(cat) || seenIds.has(item.tmdbId)) continue;
    seenCats.add(cat);

    const meta = CATEGORY_BADGE_META[cat];
    if (!meta) continue;

    slides.push({
      id: item.tmdbId,
      title: item.title,
      overview: item.overview || (item.episodeName ? `S${item.seasonNumber}E${item.episodeNumber} — ${item.episodeName}` : ""),
      backdropPath: item.backdropPath || null,
      posterPath: item.posterPath,
      year: "",
      voteAverage: 0,
      mediaType: item.kind,
      badge: meta.label,
      badgeIcon: meta.icon,
      badgeColor: meta.color,
    });
    seenIds.add(item.tmdbId);
  }

  return slides.slice(0, 6);
}

function FeaturedCarousel({ slides }: { slides: FeaturedSlide[] }) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, slides.length]);

  const slide = slides[current];
  if (!slide) return null;
  const BadgeIcon = slide.badgeIcon;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden border border-border/50"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="relative aspect-[16/10] sm:aspect-[21/9] w-full"
        >
          {/* Backdrop image — if we have a real backdrop_path (from trending),
              use it. Otherwise use the poster as a blurred background + the
              poster itself on the left side (Netflix style for titles without
              backdrop). */}
          {slide.backdropPath ? (
            <SafeImage
              src={img(slide.backdropPath, "w1280")}
              alt={slide.title}
              fill
              variant="backdrop"
              priority={current === 0}
              className="absolute inset-0"
            />
          ) : (
            <>
              {/* Blurred poster as background fill */}
              <div className="absolute inset-0 overflow-hidden">
                <SafeImage
                  src={imgOrPlaceholder(slide.posterPath, "w500")}
                  alt=""
                  fill
                  variant="poster"
                  className="absolute inset-0 object-cover scale-125 blur-2xl opacity-40"
                />
              </div>
              {/* Sharp poster on the left */}
              <div className="absolute left-4 sm:left-8 lg:left-12 bottom-0 top-0 flex items-center">
                <div className="relative w-24 sm:w-36 lg:w-44 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl flex-shrink-0">
                  <SafeImage
                    src={imgOrPlaceholder(slide.posterPath, "w342")}
                    alt={slide.title}
                    fill
                    variant="poster"
                    priority={current === 0}
                    className="object-cover"
                  />
                </div>
              </div>
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

          <div className={`absolute inset-0 flex items-end p-4 sm:p-8 lg:p-12 ${!slide.backdropPath ? "pl-36 sm:pl-52 lg:pl-60" : ""}`}>
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur text-xs font-bold uppercase tracking-wide ${slide.badgeColor}`}>
                  <BadgeIcon className="w-3 h-3" /> {slide.badge}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {slide.mediaType === "movie" ? "Movie" : "TV Show"}
                </span>
                {slide.year && <span className="text-xs text-muted-foreground">{slide.year}</span>}
                {slide.voteAverage > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400" /> {slide.voteAverage.toFixed(1)}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground drop-shadow-lg mb-2 sm:mb-4">
                {slide.title}
              </h1>
              {slide.overview && (
                <p className="text-sm sm:text-base text-foreground/80 line-clamp-2 sm:line-clamp-3 mb-4 max-w-xl">
                  {slide.overview}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button className="h-10" onClick={() => (slide.mediaType === "movie" ? goMovie(slide.id) : goTv(slide.id))}>
                  <Play className="w-4 h-4 mr-1.5 fill-current" /> View Details
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-1.5 bg-white/40"}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </motion.section>
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
