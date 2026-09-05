"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Clock3,
  Play,
  Sparkles,
  Star,
  Trophy,
  WandSparkles,
  Zap,
} from "lucide-react";
import { MediaRow } from "@/components/media/media-row";
import { SafeImage } from "@/components/media/safe-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mediaStateKey, useAnimeHub, useMediaStates, type AnimeHubItem } from "@/hooks/use-tmdb";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { useHeroCarousel } from "@/hooks/use-hero-carousel";
import { formatDateOnly } from "@/lib/date-only";
import { useNav } from "@/lib/store";
import { getTitle, getYear, img } from "@/lib/tmdb";
import { TV_STARTED_STATUSES } from "@/lib/tv-started-statuses";

function itemType(item: AnimeHubItem): "movie" | "tv" {
  return item.media_type === "movie" ? "movie" : "tv";
}

export function AnimeHubOverview({ onBrowse }: { onBrowse: () => void }) {
  const hub = useAnimeHub();
  const data = hub.data;
  const allItems = useMemo(() => data ? [
    ...data.featured,
    ...data.nextEpisodes.map((entry) => entry.item),
    ...data.shelves.watchlist,
    ...data.shelves.continueWatching,
    ...data.shelves.airingToday,
    ...data.shelves.thisSeason,
    ...data.shelves.newNoteworthy,
    ...data.shelves.hiddenGems,
    ...data.shelves.upcoming,
    ...data.shelves.recentlyWatched,
  ] : [], [data]);
  const states = useMediaStates(allItems.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: itemType(item),
  })), { enabled: allItems.length > 0 });
  const sharedStates = { data: states.data };
  const featured = states.isSuccess
    ? (data?.featured ?? []).filter((item) => {
        const mediaType = itemType(item);
        const state = states.data?.[mediaStateKey(mediaType, Number(item.id))];
        if (!state) return true;
        if (state.watched || state.userRating != null) return false;
        return mediaType === "movie" || !TV_STARTED_STATUSES.has(String(state.status || "").toLowerCase());
      })
    : [];

  if (hub.isLoading) return <AnimeHubSkeleton />;
  if (hub.isError || !data) {
    return (
      <Card className="tvtime-movie-hub__error" role="alert">
        <Sparkles aria-hidden="true" />
        <h2>Could not load your Anime world</h2>
        <p>Your library is safe. The Anime catalogue may be temporarily unavailable.</p>
        <Button variant="outline" onClick={() => hub.refetch()}>Retry</Button>
      </Card>
    );
  }

  return (
    <div className="tvtime-movie-hub__overview tvtime-anime-hub__overview">
      {featured.length > 0 ? <AnimeHubHero items={featured} /> : states.isLoading ? (
        <div className="h-[clamp(22rem,48vw,34rem)] rounded-[1.5rem] shimmer" aria-hidden="true" />
      ) : null}

      {data.shelves.continueWatching.length > 0 ? (
        <MediaRow title="Continue Watching" icon={<CirclePlay />} items={data.shelves.continueWatching} libraryStateSource={sharedStates} />
      ) : (
        <EmptyHubRow
          icon={<Trophy />}
          title="Continue Watching"
          description="Anime episodes you start will appear here without changing your tracking rules."
          action="Discover Anime"
          onAction={onBrowse}
        />
      )}

      {data.shelves.watchlist.length > 0 ? (
        <MediaRow title="Your Anime Watchlist" icon={<Bookmark />} items={data.shelves.watchlist} libraryStateSource={sharedStates} />
      ) : (
        <EmptyHubRow
          icon={<Bookmark />}
          title="Your Anime Watchlist"
          description="Save an Anime movie or series and it will be ready here."
          action="Browse"
          onAction={onBrowse}
        />
      )}

      {data.nextEpisodes.length > 0 && <AnimeUpcomingEpisodes entries={data.nextEpisodes} />}

      {data.shelves.airingToday.length > 0 && (
        <MediaRow title="Airing Today" icon={<CalendarDays />} items={data.shelves.airingToday} forcedMediaType="tv" libraryStateSource={sharedStates} />
      )}
      {data.shelves.thisSeason.length > 0 && (
        <section aria-labelledby="anime-season-title">
          <div className="tvtime-movie-hub__section-line">
            <div>
              <p className="tvtime-movie-hub__section-kicker">Seasonal spotlight</p>
              <h2 id="anime-season-title">{data.currentSeason}</h2>
            </div>
          </div>
          <MediaRow title={data.currentSeason} hideHeading items={data.shelves.thisSeason} forcedMediaType="tv" libraryStateSource={sharedStates} />
        </section>
      )}
      {data.shelves.newNoteworthy.length > 0 && (
        <MediaRow title="New & Noteworthy" icon={<WandSparkles />} items={data.shelves.newNoteworthy} libraryStateSource={sharedStates} />
      )}
      {data.shelves.hiddenGems.length > 0 && (
        <MediaRow title="Hidden Gems" icon={<Star />} items={data.shelves.hiddenGems} libraryStateSource={sharedStates} />
      )}
      {data.shelves.upcoming.length > 0 && (
        <MediaRow title="Upcoming Anime" icon={<Zap />} items={data.shelves.upcoming} libraryStateSource={sharedStates} />
      )}
      {data.shelves.recentlyWatched.length > 0 && (
        <MediaRow title="Recently Watched" icon={<Clock3 />} items={data.shelves.recentlyWatched} libraryStateSource={sharedStates} />
      )}

      {data.partial && (
        <p className="tvtime-movie-hub__partial" role="status">
          Some catalogue shelves are temporarily unavailable; your Anime library and progress are still complete.
        </p>
      )}
    </div>
  );
}

function AnimeUpcomingEpisodes({ entries }: { entries: NonNullable<ReturnType<typeof useAnimeHub>["data"]>["nextEpisodes"] }) {
  const goTv = useNav((state) => state.goTv);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragHandlers = useHorizontalDragScroll({
    scrollKey: "anime-hub:next-episodes",
    scrollRef,
    restoreDependency: entries.length,
  });
  return (
    <section className="tvtime-anime-next" aria-labelledby="anime-next-episodes-title">
      <div className="tvtime-section-heading">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="tvtime-section-heading__icon" aria-hidden="true"><CalendarDays /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="anime-next-episodes-title" className="truncate text-lg font-extrabold tracking-tight sm:text-xl">Next Episodes</h2>
              <span className="tvtime-section-heading__count tabular-nums">{entries.length}</span>
            </div>
            <p className="tvtime-section-heading__hint">Upcoming episodes from Anime you follow</p>
          </div>
        </div>
      </div>
      <div
        ref={scrollRef}
        {...dragHandlers}
        className="tvtime-anime-next__scroller no-scrollbar"
        role="region"
        aria-label="Upcoming Anime episodes horizontal list"
        tabIndex={0}
      >
        {entries.map((entry) => (
          <button
            key={`${entry.item.id}-${entry.seasonNumber ?? 0}-${entry.episodeNumber ?? 0}-${entry.airDate}`}
            type="button"
            className="tvtime-anime-next__card"
            onClick={() => goTv(entry.item.id)}
            aria-label={`Open ${getTitle(entry.item)}, next episode ${entry.airDate}`}
          >
            <span className="tvtime-anime-next__poster" aria-hidden="true">
              <SafeImage src={img(entry.item.poster_path, "w342")} alt="" fill variant="poster" sizes="72px" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <strong>{getTitle(entry.item)}</strong>
              <span>{entry.seasonNumber != null && entry.episodeNumber != null ? `S${entry.seasonNumber} · E${entry.episodeNumber}` : "Upcoming episode"}{entry.name ? ` · ${entry.name}` : ""}</span>
              <time dateTime={entry.airDate}>{formatDateOnly(entry.airDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, "en-US")}</time>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyHubRow({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className="tvtime-movie-hub__empty-row">
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onAction}>{action}</Button>
    </section>
  );
}

function AnimeHubHero({ items }: { items: AnimeHubItem[] }) {
  const goMovie = useNav((state) => state.goMovie);
  const goTv = useNav((state) => state.goTv);
  const reduceMotion = useReducedMotion();
  const carousel = useHeroCarousel({ itemCount: items.length, reducedMotion: reduceMotion });
  const active = carousel.activeIndex;
  const item = items[active % items.length];
  const mediaType = itemType(item);
  const openDetails = () => mediaType === "movie" ? goMovie(item.id) : goTv(item.id);

  return (
    <motion.section
      {...carousel.rootProps}
      className="tvtime-movie-hub-hero tvtime-anime-hub-hero"
      data-carousel-paused={carousel.isPaused ? "true" : "false"}
      style={carousel.progressStyle}
      aria-roledescription="carousel"
      aria-label={`Featured Anime ${mediaType === "movie" ? "movie" : "series"}: ${getTitle(item)}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.4 }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={`anime-backdrop-${mediaType}-${item.id}`}
          className="tvtime-movie-hub-hero__backdrop"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeOut" }}
        >
          <SafeImage src={img(item.backdrop_path, "original")} alt="" fill variant="backdrop" priority sizes="100vw" />
        </motion.div>
      </AnimatePresence>
      <div className="tvtime-movie-hub-hero__scrim" aria-hidden="true" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`anime-copy-${mediaType}-${item.id}`}
          className="tvtime-movie-hub-hero__content"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.32, ease: "easeOut" }}
        >
          <div className="tvtime-movie-hub-hero__meta">
            <span><Sparkles /> Unwatched spotlight</span>
            <span>{mediaType === "movie" ? "Movie" : "Series"}</span>
            {getYear(item) && <span>{getYear(item)}</span>}
            {item.vote_average > 0 && <span><Star className="fill-current" /> {item.vote_average.toFixed(1)}</span>}
          </div>
          <h2>{getTitle(item)}</h2>
          <p className="line-clamp-2">{item.overview}</p>
          <div className="tvtime-movie-hub-hero__actions">
            <Button size="lg" onClick={openDetails}><Play className="fill-current" /> View details</Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <div data-carousel-controls className="tvtime-home-hero__carousel-controls relative z-20" aria-label="Featured unseen Anime slides">
          <button type="button" className="tvtime-home-hero__carousel-arrow" onClick={() => carousel.moveSlide(-1)} aria-label="Previous Anime spotlight"><ChevronLeft /></button>
          <div className="tvtime-home-hero__carousel-dots">
            {items.map((candidate, index) => (
              <button
                key={`${candidate.media_type}-${candidate.id}-${index === active ? carousel.cycleVersion : 0}`}
                type="button"
                className="tvtime-home-hero__carousel-dot"
                data-active={index === active ? "true" : "false"}
                onClick={() => carousel.selectSlide(index)}
                aria-label={`Show ${getTitle(candidate)}`}
                aria-current={index === active ? "true" : undefined}
              />
            ))}
          </div>
          <button type="button" className="tvtime-home-hero__carousel-arrow" onClick={() => carousel.moveSlide(1)} aria-label="Next Anime spotlight"><ChevronRight /></button>
        </div>
      )}
    </motion.section>
  );
}

function AnimeHubSkeleton() {
  return (
    <div className="tvtime-movie-hub__skeleton" role="status" aria-busy="true" aria-label="Loading Anime hub">
      <span className="sr-only">Loading Anime hub…</span>
      <div className="h-[clamp(22rem,48vw,34rem)] rounded-[1.5rem] shimmer" />
      {Array.from({ length: 5 }).map((_, section) => (
        <div key={section}>
          <div className="mb-3 h-6 w-44 rounded shimmer" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((__, card) => <div key={card} className="aspect-[2/3] w-36 shrink-0 rounded-2xl shimmer" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
