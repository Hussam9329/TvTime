"use client";

import { mediaStateKey, useHomeFeed, useMediaStates, useMovieDetail, useRecentlyWatched, useStats, useTvDetail, useWatchlistToggle, type MediaBatchState } from "@/hooks/use-tmdb";
import { MediaRow as BaseMediaRow } from "@/components/media/media-row";
import { MEDIA_CARD_ROW_WIDTH_CLASS } from "@/components/media/media-card";
import { GenreRecommendations } from "@/components/media/genre-recommendations";
import { TabbedMediaRow } from "@/components/media/tabbed-media-row";
import { HomeCuratedSections } from "@/components/media/home-curated-sections";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Compass, Flame, Plus, Star, TrendingUp, Tv, Clock, Film, Play, BookOpen, Check, Languages, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useNav } from "@/lib/store";
import { img, imgOrPlaceholder, getYear, getTitle, type MediaItem } from "@/lib/tmdb";
import { SafeImage } from "@/components/media/safe-image";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState, type ComponentProps } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import "./home-view.css";
import { toast } from "sonner";
import { useHeroCarousel } from "@/hooks/use-hero-carousel";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import {
  filterAndPrioritizeMediaCollectionWorldItems,
  filterAndPrioritizeMediaCollectionWorldItemsBy,
} from "@/lib/media-world-pipeline";
import { TV_STARTED_STATUSES } from "@/lib/tv-started-statuses";
import type { MediaCollectionWorld } from "@/lib/media-world-classification";

const HOME_ROW_ITEM_LIMIT = 12;
const MediaRow = ({ items, ...props }: ComponentProps<typeof BaseMediaRow>) => (
  <BaseMediaRow {...props} items={items.slice(0, HOME_ROW_ITEM_LIMIT)} compactCards={false} />
);

function standardCollectionWorldForHomeItem(item: MediaItem): MediaCollectionWorld | null {
  if (item.media_type === "tv") return "standard-tv";
  if (item.media_type === "movie") return "movies";
  return null;
}

function filterAndPrioritizeStandardHomeItems(items: readonly MediaItem[]) {
  return filterAndPrioritizeMediaCollectionWorldItemsBy(items, standardCollectionWorldForHomeItem);
}

function isUnseenHomeHeroState(mediaType: "movie" | "tv", state: MediaBatchState | undefined) {
  if (!state) return true;
  if (state.watched || state.userRating != null) return false;
  if (mediaType === "movie") return true;
  return !TV_STARTED_STATUSES.has(String(state.status || "").trim().toLowerCase());
}

export function HomeView() {
  const homeFeed = useHomeFeed();

  const stats = useStats();

  const setView = useNav((s) => s.setView);

  const standardTrending = filterAndPrioritizeStandardHomeItems(homeFeed.data?.trending.results ?? []);
  const popularMovieItems = filterAndPrioritizeMediaCollectionWorldItems(
    (homeFeed.data?.popularMovies.results ?? []).filter((media) => media.poster_path),
    "movies",
  );
  const onAirTvItems = filterAndPrioritizeMediaCollectionWorldItems(
    (homeFeed.data?.onTheAirTv.results ?? []).filter((media) => media.poster_path),
    "standard-tv",
  );
  const popularTvItems = filterAndPrioritizeMediaCollectionWorldItems(
    (homeFeed.data?.popularTv.results ?? []).filter((media) => media.poster_path),
    "standard-tv",
  );
  const topMovieItems = filterAndPrioritizeMediaCollectionWorldItems(
    (homeFeed.data?.topRatedMovies.results ?? []).filter((media) => media.poster_path),
    "movies",
  );
  const topTvItems = filterAndPrioritizeMediaCollectionWorldItems(
    (homeFeed.data?.topRatedTv.results ?? []).filter((media) => media.poster_path),
    "standard-tv",
  );
  const upcomingMovieItems = filterAndPrioritizeMediaCollectionWorldItems(
    (homeFeed.data?.upcomingMovies.results ?? []).filter((media) => media.poster_path),
    "movies",
  );
  const heroCandidates = standardTrending.filter((media) => media.backdrop_path);
  const homeLibraryStates = useMediaStates([
    ...standardTrending.map((item) => ({ tmdbId: Number(item.id), mediaType: item.media_type === "tv" ? "tv" as const : "movie" as const })),
    ...popularMovieItems.slice(0, HOME_ROW_ITEM_LIMIT).map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })),
    ...onAirTvItems.slice(0, HOME_ROW_ITEM_LIMIT).map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })),
    ...popularTvItems.slice(0, HOME_ROW_ITEM_LIMIT).map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })),
    ...topMovieItems.slice(0, HOME_ROW_ITEM_LIMIT).map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })),
    ...topTvItems.slice(0, HOME_ROW_ITEM_LIMIT).map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })),
    ...upcomingMovieItems.slice(0, HOME_ROW_ITEM_LIMIT).map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })),
  ]);
  const unseenHeroCandidates = homeLibraryStates.isSuccess
    ? heroCandidates.filter((media) => {
        const mediaType = media.media_type === "tv" ? "tv" as const : "movie" as const;
        const state = homeLibraryStates.data?.[mediaStateKey(mediaType, Number(media.id))];
        return isUnseenHomeHeroState(mediaType, state);
      })
    : heroCandidates;
  const heroItems = filterAndPrioritizeStandardHomeItems([
    ...unseenHeroCandidates.filter((media) => (media.overview?.length || 0) > 100),
    ...unseenHeroCandidates.filter((media) => (media.overview?.length || 0) <= 100),
  ]).slice(0, 5);
  const sharedLibraryStateSource = { data: homeLibraryStates.data };
  const homeFeedFailed = homeFeed.isError && !homeFeed.data;

  const heroFallback = homeFeed.isLoading ? <HomeHeroSkeleton /> : null;

  return (
    <div className="tvtime-home-view">
      {heroItems.length > 0 ? <Hero items={heroItems} libraryStates={homeLibraryStates.data} /> : heroFallback}

      {/* Personal: pick up where you left off, then the collection at a glance */}
      <RecentlyWatched />

      {stats.data && (
        <section className="tvtime-library-overview tvtime-collection-overview" aria-labelledby="collection-overview-title">
          <div className="tvtime-library-overview__header">
            <h2 id="collection-overview-title" className="text-lg font-extrabold tracking-tight sm:text-xl">
              Your collection
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setView("stats")}>
              View statistics
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>

          <div className="tvtime-stat-grid">
            <QuickStat
              icon={<Film />}
              label="All Movies Watched"
              value={stats.data.counts.watchedMoviesAll ?? 0}
              onClick={() => setView("stats")}
            />
            <QuickStat
              icon={<Tv />}
              label="All TV Shows"
              value={stats.data.counts.seriesAll ?? 0}
              onClick={() => setView("stats")}
            />
            <QuickStat
              icon={<Check />}
              label="Episodes Watched"
              value={stats.data.counts.watchedEpisodes ?? 0}
              onClick={() => setView("stats")}
            />
            <QuickStat
              icon={<Clock />}
              label="Watch time"
              value={stats.data.watchTime?.totalHours || 0}
              suffix="h"
              onClick={() => setView("stats")}
            />
          </div>

          <div className="tvtime-collection-overview__worlds" aria-label="Collections by world">
            <WorldChip
              icon={<BookOpen />}
              label="All Movie Watchlists"
              value={stats.data.counts.movieWatchlistAll ?? 0}
              onClick={() => setView("stats")}
            />
            <WorldChip
              icon={<Star />}
              label="Anime Collection"
              value={stats.data.counts.animeTitles ?? 0}
              onClick={() => setView("anime")}
            />
            <WorldChip
              icon={<Languages />}
              label="Arabic Movies"
              value={stats.data.counts.arabicMovies ?? 0}
              onClick={() => setView("arabic-movies")}
            />
            <WorldChip
              icon={<Languages />}
              label="Arabic TV"
              value={stats.data.counts.arabicShows ?? 0}
              onClick={() => setView("arabic-tv")}
            />
            <WorldChip
              icon={<Globe2 />}
              label="Asian Movies"
              value={stats.data.counts.asianMovies ?? 0}
              onClick={() => setView("asian-movies")}
            />
            <WorldChip
              icon={<Globe2 />}
              label="Asian TV"
              value={stats.data.counts.asianShows ?? 0}
              onClick={() => setView("asian-tv")}
            />
          </div>
        </section>
      )}

      {/* Browse: what's popular right now, grouped by medium */}
      <HomeSectionHeading eyebrow="Browse" title="What’s on right now" />
      {homeFeedFailed ? (
        <ErrorState
          title="Couldn’t load Home"
          description="Trending, popular and upcoming titles didn’t load. Check your connection and try again."
          onRetry={() => void homeFeed.refetch()}
        />
      ) : (
        <>
          <MediaRow
            title="Trending Now"
            icon={<Flame className="w-5 h-5" />}
            items={standardTrending}
            loading={homeFeed.isLoading}
            hint="Movies and shows everyone is watching this week"
            showCount={false}
            libraryStateSource={sharedLibraryStateSource}
          />
          <TabbedMediaRow
            title="Movies"
            icon={<Film className="w-5 h-5" />}
            hint={null}
            compactCards={false}
            onSeeAll={() => setView("movies")}
            libraryStateSource={sharedLibraryStateSource}
            tabs={[
              { value: "popular", label: "Popular", items: popularMovieItems.slice(0, HOME_ROW_ITEM_LIMIT), loading: homeFeed.isLoading, forcedMediaType: "movie" },
              { value: "top-rated", label: "Top rated", items: topMovieItems.slice(0, HOME_ROW_ITEM_LIMIT), loading: homeFeed.isLoading, forcedMediaType: "movie" },
              { value: "upcoming", label: "Coming soon", items: upcomingMovieItems.slice(0, HOME_ROW_ITEM_LIMIT), loading: homeFeed.isLoading, forcedMediaType: "movie" },
            ]}
          />
          <TabbedMediaRow
            title="TV Shows"
            icon={<Tv className="w-5 h-5" />}
            hint={null}
            compactCards={false}
            onSeeAll={() => setView("tv-shows")}
            libraryStateSource={sharedLibraryStateSource}
            tabs={[
              { value: "on-air", label: "On the air", items: onAirTvItems.slice(0, HOME_ROW_ITEM_LIMIT), loading: homeFeed.isLoading, forcedMediaType: "tv" },
              { value: "popular", label: "Popular", items: popularTvItems.slice(0, HOME_ROW_ITEM_LIMIT), loading: homeFeed.isLoading, forcedMediaType: "tv" },
              { value: "top-rated", label: "Top rated", items: topTvItems.slice(0, HOME_ROW_ITEM_LIMIT), loading: homeFeed.isLoading, forcedMediaType: "tv" },
            ]}
          />
        </>
      )}

      {/* Personalised and editorial picks, loaded as they scroll into view */}
      <HomeSectionHeading eyebrow="For you" title="Picked from your taste" />
      <GenreRecommendations />
      <HomeCuratedSections />
    </div>
  );
}

function HomeSectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="tvtime-home-section-heading">
      <p className="tvtime-eyebrow">{eyebrow}</p>
      <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
    </header>
  );
}

function WorldChip({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tvtime-world-chip" aria-label={`${label}: ${value}`}>
      <span className="tvtime-world-chip__icon" aria-hidden="true">{icon}</span>
      <span className="tvtime-world-chip__label">{label}</span>
      <strong className="tvtime-world-chip__value tabular-nums">{value}</strong>
    </button>
  );
}

function HomeHeroSkeleton() {
  return (
    <section
      data-ui-surface="hero"
      className="tvtime-home-hero relative overflow-hidden shimmer"
      role="status"
      aria-busy="true"
      aria-label="Loading featured title"
    >
      <span className="sr-only">Loading featured title…</span>
    </section>
  );
}

function QuickStat({ icon, label, value, suffix, onClick }: { icon: React.ReactNode; label: string; value: number | string; suffix?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tvtime-quick-stat group"
      aria-label={`${label}: ${value}${suffix ?? ""}`}
    >
      <span className="tvtime-quick-stat__icon" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="tvtime-quick-stat__label">{label}</span>
        <strong className="tvtime-quick-stat__value tabular-nums">
          {value}{suffix && <span>{suffix}</span>}
        </strong>
      </span>
      <ArrowRight className="tvtime-quick-stat__arrow" aria-hidden="true" />
    </button>
  );
}

function Hero({ items, libraryStates }: { items: MediaItem[]; libraryStates?: Record<string, MediaBatchState> }) {
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const shouldReduceMotion = useReducedMotion();
  const carousel = useHeroCarousel({ itemCount: items.length, reducedMotion: shouldReduceMotion });
  const watchlistToggle = useWatchlistToggle();
  const activeIndex = carousel.activeIndex;
  const item = items[activeIndex] ?? items[0];
  const mediaType = item.media_type === "tv" || !item.title ? "tv" : "movie";
  const title = getTitle(item);
  const slideKey = `${mediaType}-${item.id}`;
  // Tagline and network only exist on the detail payload; the active slide's
  // detail is cached by React Query, so cycling back costs nothing.
  const movieDetail = useMovieDetail(mediaType === "movie" ? item.id : null);
  const tvDetail = useTvDetail(mediaType === "tv" ? item.id : null);
  const detail = mediaType === "movie" ? movieDetail.data : tvDetail.data;
  const tagline = detail?.tagline?.trim() || null;
  const network = mediaType === "tv" ? tvDetail.data?.networks?.find((entry) => entry.logo_path) ?? null : null;
  const inWatchlist = Boolean(libraryStates?.[mediaStateKey(mediaType, item.id)]?.inWatchlist);
  const openDetails = () => (mediaType === "movie" ? goMovie(item.id) : goTv(item.id));
  const counter = (value: number) => String(value).padStart(2, "0");

  const toggleWatchlist = async () => {
    try {
      await watchlistToggle.mutateAsync({
        action: inWatchlist ? "remove" : "add",
        mediaType,
        tmdbId: item.id,
        title,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        overview: item.overview,
        releaseDate: item.release_date || item.first_air_date,
        voteAverage: item.vote_average,
        genreIds: item.genre_ids,
        originalLanguage: item.original_language ?? null,
        originCountry: item.origin_country ?? null,
      });
      toast.success(inWatchlist ? `${title} removed from your watchlist` : `${title} added to your watchlist`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t update your watchlist");
    }
  };

  return (
    <motion.section
      {...carousel.rootProps}
      data-ui-surface="hero"
      data-carousel-paused={carousel.isPaused ? "true" : "false"}
      style={carousel.progressStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
      className="tvtime-stage"
      aria-label={`Featured ${mediaType === "movie" ? "movie" : "TV show"}: ${title}`}
      aria-roledescription="carousel"
    >
      {/* Full-bleed artwork: the backdrop spans the whole viewport, behind the header. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`backdrop-${slideKey}`}
          className="tvtime-stage__backdrop"
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.8, ease: "easeOut" }}
          aria-hidden="true"
        >
          <SafeImage
            src={img(item.backdrop_path, "original")}
            alt=""
            fill
            variant="backdrop"
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>
      <div className="tvtime-stage__scrim bg-gradient-to-r from-black/85" aria-hidden="true" />
      <div className="tvtime-stage__fade" aria-hidden="true" />

      <div className="tvtime-stage__inner">
        {items.length > 1 && (
          <div data-carousel-controls className="tvtime-stage__controls tvtime-home-hero__carousel-controls" aria-label="Trending spotlight slides">
            <button type="button" className="tvtime-home-hero__carousel-arrow" onClick={() => carousel.moveSlide(-1)} aria-label="Previous spotlight">
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="tvtime-home-hero__carousel-dots">
              {items.map((slide, index) => (
                <button
                  key={`${slide.media_type ?? "media"}-${slide.id}-${index === activeIndex ? carousel.cycleVersion : 0}`}
                  type="button"
                  className="tvtime-home-hero__carousel-dot"
                  data-active={index === activeIndex ? "true" : "false"}
                  onClick={() => carousel.selectSlide(index)}
                  aria-label={`Show spotlight ${index + 1}: ${getTitle(slide)}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                />
              ))}
            </div>
            <button type="button" className="tvtime-home-hero__carousel-arrow" onClick={() => carousel.moveSlide(1)} aria-label="Next spotlight">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`content-${slideKey}`}
            className="tvtime-stage__content"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.36, ease: "easeOut" }}
          >
            <div className="tvtime-stage__copy">
              <p className="tvtime-stage__eyebrow">Featured today</p>
              <div className="tvtime-stage__chips">
                <span className="tvtime-stage__chip is-featured"><Flame aria-hidden="true" />Featured</span>
                <span className="tvtime-stage__chip">{mediaType === "movie" ? "Movie" : "TV Show"}</span>
                {getYear(item) && <span className="tvtime-stage__chip">{getYear(item)}</span>}
                {item.vote_average > 0 && (
                  <span className="tvtime-stage__chip is-rating"><Star className="fill-current" aria-hidden="true" />{item.vote_average.toFixed(1)}</span>
                )}
                {network?.logo_path && (
                  <span className="tvtime-stage__chip is-network" title={network.name}>
                    <SafeImage src={img(network.logo_path, "w92")} alt={network.name} width={46} height={16} variant="logo" />
                  </span>
                )}
              </div>

              <h1 className="tvtime-stage__title">{title}</h1>
              {tagline && <p className="tvtime-stage__tagline">{tagline}</p>}
              <p className="tvtime-stage__overview line-clamp-3 text-white/85">{item.overview}</p>

              <div className="tvtime-stage__actions">
                <Button size="lg" className="tvtime-stage__primary" onClick={openDetails}>
                  <Play className="fill-current" aria-hidden="true" />
                  View details
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="tvtime-stage__secondary"
                  onClick={() => void toggleWatchlist()}
                  disabled={watchlistToggle.isPending}
                  aria-pressed={inWatchlist}
                >
                  {inWatchlist ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {inWatchlist ? "In watchlist" : "Add to watchlist"}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="tvtime-stage__icon-button"
                  onClick={() => setView("discover")}
                  aria-label="Explore more titles"
                  title="Explore more"
                >
                  <Compass aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="tvtime-stage__aside">
              {items.length > 1 && (
                <p className="tvtime-stage__counter" aria-hidden="true">
                  <strong>{counter(activeIndex + 1)}</strong> / {counter(items.length)}
                </p>
              )}
              <button type="button" className="tvtime-stage__poster" onClick={openDetails} aria-label={`Open ${title}`}>
                <span className="tvtime-stage__poster-label">Trending spotlight</span>
                <span className="tvtime-stage__poster-art">
                  <SafeImage src={imgOrPlaceholder(item.poster_path, "w500")} alt="" fill variant="poster" priority sizes="220px" />
                </span>
                <span className="tvtime-stage__poster-title">{title}</span>
                <span className="tvtime-stage__poster-trend">Now trending <TrendingUp aria-hidden="true" /></span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

type RecentKind = "all" | "movie" | "tv" | "anime";
const RECENT_FILTERS: Array<{ value: RecentKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "anime", label: "Anime" },
];

function recentKind(item: { kind: "movie" | "tv"; isAnime?: boolean }): Exclude<RecentKind, "all"> {
  if (item.isAnime) return "anime";
  return item.kind;
}

function RecentlyWatched() {
  const recently = useRecentlyWatched(12);
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<RecentKind>("all");
  const allItems = recently.data?.items ?? [];
  const availableKinds = new Set(allItems.map(recentKind));
  const filters = RECENT_FILTERS.filter((filter) => filter.value === "all" || availableKinds.has(filter.value));
  const activeKind = kind !== "all" && !availableKinds.has(kind) ? "all" : kind;
  const items = activeKind === "all" ? allItems : allItems.filter((item) => recentKind(item) === activeKind);
  const dragHandlers = useHorizontalDragScroll({
    scrollKey: recently.isLoading ? undefined : "home:recently-watched",
    scrollRef,
    restoreDependency: `${recently.isLoading}:${items.length}:${activeKind}`,
  });

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
      <section className="tvtime-media-row tvtime-recent" role="status" aria-busy="true" aria-label="Loading recently watched titles">
        <span className="sr-only">Loading recently watched titles…</span>
        <div className="tvtime-recent__header" aria-hidden="true">
          <div>
            <h2 className="tvtime-display-heading">Recently Watched</h2>
            <p>Your latest viewing activity</p>
          </div>
        </div>
        <div className="tvtime-recent-scroller no-scrollbar flex overflow-x-auto" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`tvtime-media-row-item tvtime-recent-card flex-shrink-0 ${MEDIA_CARD_ROW_WIDTH_CLASS}`}>
              <div className="aspect-[2/3] rounded-2xl shimmer" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (allItems.length === 0) return null;

  return (
    <section className="tvtime-media-row tvtime-recent" aria-labelledby="recently-watched-title">
      <div className="tvtime-recent__header">
        <div>
          <h2 id="recently-watched-title" className="tvtime-display-heading">Recently Watched</h2>
          <p>Your latest viewing activity</p>
        </div>
        {filters.length > 2 && (
          <ToggleGroup
            type="single"
            value={activeKind}
            onValueChange={(value) => { if (value) setKind(value as RecentKind); }}
            className="tvtime-recent__filters"
            aria-label="Filter recently watched"
          >
            {filters.map((filter) => (
              <ToggleGroupItem key={filter.value} value={filter.value} className="tvtime-recent__filter">
                {filter.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
      <div
        ref={scrollRef}
        {...dragHandlers}
        className="tvtime-recent-scroller no-scrollbar flex overflow-x-auto"
        role="region"
        aria-label="Recently watched horizontal list"
        tabIndex={0}
      >
        {items.map((item, index) => (
          <RecentlyWatchedCard key={`${item.kind}-${item.tmdbId ?? item.id}-${item.watchedAt}`} item={item} index={index} onGo={() => handleGo(item)} />
        ))}
      </div>
    </section>
  );
}

function formatRecentlyWatchedDate(value: string | number | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."][date.getMonth()];
  const day = date.getDate();
  const mod100 = day % 100;
  const suffix = mod100 >= 11 && mod100 <= 13
    ? "th"
    : day % 10 === 1
      ? "st"
      : day % 10 === 2
        ? "nd"
        : day % 10 === 3
          ? "rd"
          : "th";

  return `${month} ${day}${suffix}, ${date.getFullYear()}`;
}

function RecentlyWatchedCard({ item, index, onGo }: { item: any; index: number; onGo: () => void }) {
  const title = item.title || "Untitled";
  const posterSrc = imgOrPlaceholder(item.posterPath || null, "w342");
  const isMovie = item.kind === "movie";
  const isFinishedShow = !isMovie && item.status === "finished";
  const watchedDate = formatRecentlyWatchedDate(item.watchedAt);
  const tmdbId = Number(item.tmdbId);
  const detailHref = item.hasProfile && Number.isFinite(tmdbId) && tmdbId > 0
    ? `/${isMovie ? "movie" : "tv"}/${tmdbId}`
    : undefined;
  const total = Number(item.totalEpisodes) || 0;
  const watchedCount = Number(item.watchedEpisodeCount) || 0;
  const progress = !isMovie && total > 0 ? Math.min(100, Math.round((watchedCount / total) * 100)) : null;
  const meta = isMovie
    ? ["Movie", item.year].filter(Boolean).join(" • ")
    : item.seasonNumber != null && item.episodeNumber != null ? `S${item.seasonNumber} E${item.episodeNumber}` : "TV Show";
  const shortDate = item.watchedAt ? new Date(item.watchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <div
      aria-disabled={!item.hasProfile}
      className={`tvtime-media-row-item tvtime-media-card tvtime-recent-card group relative flex-shrink-0 cursor-pointer text-left aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${MEDIA_CARD_ROW_WIDTH_CLASS}`}
      data-media-type={isMovie ? "movie" : "tv"}
      title={title}
    >
      {detailHref && (
        <a
          href={detailHref}
          aria-label={`Open ${title}${watchedDate ? ` · watched ${watchedDate}` : ""}`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onGo();
          }}
        />
      )}
      <div className="tvtime-media-poster tvtime-recent-poster relative aspect-[2/3] overflow-hidden bg-muted">
        <SafeImage
          src={posterSrc}
          alt={title}
          fill
          variant="poster"
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index === 0 ? "high" : "auto"}
          className="tvtime-media-poster__image object-cover"
        />
        <div className="tvtime-recent-card__veil pointer-events-none absolute inset-0" aria-hidden="true" />
        {(isMovie || isFinishedShow) && (
          <WatchedIndicator
            rating={item.userRating}
            status={isFinishedShow ? "finished" : "watched"}
          />
        )}
        {!isMovie && !isFinishedShow && <TmdbScoreIndicator rating={item.publicRating} />}
        <div className="tvtime-recent-card__info">
          <p className="tvtime-recent-card__title">{title}</p>
          <p className="tvtime-recent-card__meta">{meta}</p>
          {progress != null ? (
            <div className="tvtime-recent-card__progress" aria-label={`${progress}% of episodes watched`}>
              <span className="tvtime-recent-card__track"><span style={{ width: `${progress}%` }} /></span>
              <span className="tabular-nums">{progress}%</span>
            </div>
          ) : (
            <p className="tvtime-recent-card__status">
              <CheckCircle2 aria-hidden="true" />
              {shortDate ? `Watched · ${shortDate}` : "Watched"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
