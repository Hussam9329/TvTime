"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  EyeOff,
  Film,
  Grid2X2,
  Library,
  ListFilter,
  Play,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/media/safe-image";
import { MediaRow } from "@/components/media/media-row";
import { RatingDialog } from "@/components/media/rating-dialog";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";
import {
  mediaStateKey,
  useMediaStates,
  useMovieHub,
  useWatchedMovieToggle,
  useWatchlistToggle,
  type MediaBatchState,
  type MovieHubItem,
  type MovieHubWorld,
  type MovieTonightMode,
} from "@/hooks/use-tmdb";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import { useNav } from "@/lib/store";
import { getTitle, getYear, img, imgOrPlaceholder } from "@/lib/tmdb";

type HubTab = "overview" | "library" | "discover" | "releases";

type WorldCopy = {
  title: string;
  eyebrow: string;
  tabs: Record<HubTab, string>;
  browse: string;
  featured: string;
  watchlist: string;
  tonight: string;
  newNoteworthy: string;
  hiddenGems: string;
  recent: string;
  comingSoon: string;
  viewDetails: string;
  addWatchlist: string;
  inWatchlist: string;
  markWatched: string;
  watched: string;
  notInterested: string;
  retry: string;
  emptyWatchlist: string;
  emptyRecent: string;
};

const WORLD_COPY: Record<MovieHubWorld, WorldCopy> = {
  movies: {
    title: "Movies",
    eyebrow: "Your movie world",
    tabs: { overview: "Overview", library: "My Library", discover: "Discover", releases: "Releases" },
    browse: "Browse & Filters",
    featured: "Featured for you",
    watchlist: "Your Watchlist",
    tonight: "Pick for Tonight",
    newNoteworthy: "New & Noteworthy",
    hiddenGems: "Hidden Gems",
    recent: "Recently Watched",
    comingSoon: "Coming Soon",
    viewDetails: "View details",
    addWatchlist: "Add to Watchlist",
    inWatchlist: "In Watchlist",
    markWatched: "Mark watched",
    watched: "Watched",
    notInterested: "Not interested",
    retry: "Retry",
    emptyWatchlist: "Your watchlist is ready for its first movie.",
    emptyRecent: "Movies you finish will appear here without disappearing from your history.",
  },
  "arabic-movies": {
    title: "الأفلام العربية",
    eyebrow: "عالم أفلامك العربية",
    tabs: { overview: "نظرة عامة", library: "مكتبتي", discover: "اكتشاف", releases: "الإصدارات" },
    browse: "التصفح والفلاتر",
    featured: "مختار لك",
    watchlist: "قائمة مشاهدتك",
    tonight: "اختيار الليلة",
    newNoteworthy: "جديد ويستحق المشاهدة",
    hiddenGems: "جواهر مخفية",
    recent: "شاهدتها مؤخراً",
    comingSoon: "قريباً",
    viewDetails: "عرض التفاصيل",
    addWatchlist: "أضف لقائمة المشاهدة",
    inWatchlist: "ضمن قائمة المشاهدة",
    markWatched: "تحديد كمُشاهد",
    watched: "تمت مشاهدته",
    notInterested: "غير مهتم",
    retry: "إعادة المحاولة",
    emptyWatchlist: "قائمة مشاهدتك جاهزة لأول فيلم عربي.",
    emptyRecent: "الأفلام التي تنهيها ستظهر هنا وتبقى محفوظة في سجلّك.",
  },
  "asian-movies": {
    title: "Asian Movies",
    eyebrow: "Cinema across Asia",
    tabs: { overview: "Overview", library: "My Library", discover: "Discover", releases: "Releases" },
    browse: "Browse & Filters",
    featured: "Featured from Asia",
    watchlist: "Your Asian Watchlist",
    tonight: "Pick for Tonight",
    newNoteworthy: "New & Noteworthy",
    hiddenGems: "Hidden Gems",
    recent: "Recently Watched",
    comingSoon: "Coming Soon",
    viewDetails: "View details",
    addWatchlist: "Add to Watchlist",
    inWatchlist: "In Watchlist",
    markWatched: "Mark watched",
    watched: "Watched",
    notInterested: "Not interested",
    retry: "Retry",
    emptyWatchlist: "Your Asian movie watchlist is ready for its first title.",
    emptyRecent: "Asian movies you finish will appear here and remain in your history.",
  },
};

const TONIGHT_OPTIONS: Array<{ value: MovieTonightMode; label: string }> = [
  { value: "smart", label: "For you" },
  { value: "under100", label: "Under 100 min" },
  { value: "rated", label: "Highly rated" },
  { value: "new", label: "New" },
  { value: "hidden", label: "Hidden gem" },
  { value: "classic", label: "Classic" },
];

export function MovieHubView({ world }: { world: MovieHubWorld }) {
  const copy = WORLD_COPY[world];
  const isArabic = world === "arabic-movies";
  const [tab, setTab] = useState<HubTab>("overview");
  const hub = useMovieHub(world);
  const summary = hub.data?.summary;

  const summaryLine = isArabic
    ? `${summary?.watchlist ?? "…"} في قائمة المشاهدة • ${summary?.watched ?? "…"} تمت مشاهدته • ${summary?.averageRating ?? "—"} متوسط تقييمك`
    : `${summary?.watchlist ?? "…"} in Watchlist • ${summary?.watched ?? "…"} Watched • ${summary?.averageRating ?? "—"} Average rating`;

  return (
    <div
      className="tvtime-movie-hub"
      data-world={world}
      dir={isArabic ? "rtl" : "ltr"}
      lang={isArabic ? "ar" : "en"}
    >
      <header className="tvtime-movie-hub__titlebar">
        <div className="min-w-0">
          <p className="tvtime-movie-hub__eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="tvtime-movie-hub__summary" aria-live="polite">{summaryLine}</p>
        </div>
        <Button className="tvtime-movie-hub__browse" onClick={() => setTab("discover")}>
          <ListFilter aria-hidden="true" />
          {copy.browse}
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as HubTab)} className="min-w-0">
        <TabsList className="tvtime-movie-hub__tabs">
          <TabsTrigger value="overview"><Grid2X2 /> {copy.tabs.overview}</TabsTrigger>
          <TabsTrigger value="library"><Library /> {copy.tabs.library}</TabsTrigger>
          <TabsTrigger value="discover"><Sparkles /> {copy.tabs.discover}</TabsTrigger>
          <TabsTrigger value="releases"><CalendarDays /> {copy.tabs.releases}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <MovieHubOverview world={world} copy={copy} query={hub} onBrowse={() => setTab("discover")} />
        </TabsContent>
        <TabsContent value="library" className="mt-0">
          <CollectionWorldView world={world} embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView
            world={world}
            embedded
            title={isArabic ? "اكتشف أفلاماً عربية" : world === "asian-movies" ? "Discover Asian Movies" : "Discover Movies"}
            subtitle={isArabic ? "نتائج عربية فقط، مع فلاتر واضحة وقابلة للإزالة." : "Choose what to see first, then refine the catalogue without visual clutter."}
          />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            accentClass={world === "asian-movies" ? "text-red-300" : world === "arabic-movies" ? "text-orange-300" : "text-primary"}
            originalLanguage={world === "arabic-movies" ? "ar" : undefined}
            language={world === "arabic-movies" ? "ar" : undefined}
            collectionWorld={world}
            title={world === "arabic-movies" ? "جدول إصدارات الأفلام العربية" : world === "asian-movies" ? "Asian Movie Release Schedule" : "Movie Release Schedule"}
            subtitle={world === "arabic-movies" ? "إصدارات الأفلام العربية خلال ستة أشهر، مرتبة بالتاريخ المعلن." : world === "asian-movies" ? "Upcoming Asian films from Korea, Japan, China and the rest of Asia." : "A clean six-month agenda for upcoming films."}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MovieHubOverview({
  world,
  copy,
  query,
  onBrowse,
}: {
  world: MovieHubWorld;
  copy: WorldCopy;
  query: ReturnType<typeof useMovieHub>;
  onBrowse: () => void;
}) {
  const [tonightMode, setTonightMode] = useState<MovieTonightMode>("smart");
  const data = query.data;
  const allItems = useMemo(() => {
    if (!data) return [];
    return [
      ...data.featured,
      ...data.shelves.watchlist,
      ...Object.values(data.shelves.tonight).flat(),
      ...data.shelves.newNoteworthy,
      ...data.shelves.hiddenGems,
      ...data.shelves.recentlyWatched,
      ...data.shelves.comingSoon,
    ];
  }, [data]);
  const states = useMediaStates(allItems.map((item) => ({ tmdbId: item.id, mediaType: "movie" as const })), {
    enabled: Boolean(data),
  });
  const sharedStates = { data: states.data };

  if (query.isLoading) return <MovieHubSkeleton />;
  if (query.isError || !data) {
    return (
      <Card className="tvtime-movie-hub__error" role="alert">
        <Film aria-hidden="true" />
        <h2>Could not load this movie world</h2>
        <p>Your library is safe. The catalogue service may be temporarily unavailable.</p>
        <Button variant="outline" onClick={() => query.refetch()}>{copy.retry}</Button>
      </Card>
    );
  }

  const tonightItems = data.shelves.tonight[tonightMode] ?? [];
  return (
    <div className="tvtime-movie-hub__overview">
      {data.featured.length > 0 && (
        <MovieHubHero
          items={data.featured}
          copy={copy}
          world={world}
          states={states.data}
          statesReady={states.isSuccess}
        />
      )}

      <HubRowOrEmpty
        title={copy.watchlist}
        hint="Saved for later"
        icon={<Bookmark />}
        items={data.shelves.watchlist}
        emptyText={copy.emptyWatchlist}
        actionLabel={copy.browse}
        onAction={onBrowse}
        states={sharedStates}
      />

      <section className="tvtime-movie-hub__tonight" aria-labelledby={`tonight-${world}`}>
        <div className="tvtime-movie-hub__section-line">
          <div>
            <p className="tvtime-movie-hub__section-kicker">Smart picks</p>
            <h2 id={`tonight-${world}`}>{copy.tonight}</h2>
          </div>
          <div className="tvtime-movie-hub__quick-picks no-scrollbar" aria-label="Tonight filters">
            {TONIGHT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-active={tonightMode === option.value ? "true" : "false"}
                onClick={() => setTonightMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <MediaRow title={copy.tonight} hideHeading items={tonightItems} forcedMediaType="movie" libraryStateSource={sharedStates} />
      </section>

      <MediaRow title={copy.newNoteworthy} icon={<WandSparkles />} items={data.shelves.newNoteworthy} forcedMediaType="movie" libraryStateSource={sharedStates} />
      <MediaRow title={copy.hiddenGems} icon={<Star />} items={data.shelves.hiddenGems} forcedMediaType="movie" libraryStateSource={sharedStates} />
      <HubRowOrEmpty
        title={copy.recent}
        hint="Your viewing history"
        icon={<Clock3 />}
        items={data.shelves.recentlyWatched}
        emptyText={copy.emptyRecent}
        states={sharedStates}
      />
      <MediaRow title={copy.comingSoon} icon={<CalendarDays />} items={data.shelves.comingSoon} forcedMediaType="movie" libraryStateSource={sharedStates} />

      {data.partial && (
        <p className="tvtime-movie-hub__partial" role="status">Some recommendations are temporarily unavailable; your library sections are still complete.</p>
      )}
    </div>
  );
}

function HubRowOrEmpty({
  title,
  hint,
  icon,
  items,
  emptyText,
  actionLabel,
  onAction,
  states,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  items: MovieHubItem[];
  emptyText: string;
  actionLabel?: string;
  onAction?: () => void;
  states: { data?: Record<string, MediaBatchState> };
}) {
  if (items.length > 0) {
    return <MediaRow title={title} icon={icon} items={items} forcedMediaType="movie" libraryStateSource={states} />;
  }
  return (
    <section className="tvtime-movie-hub__empty-row">
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2>{title}</h2>
        <p>{emptyText || hint}</p>
      </div>
      {actionLabel && onAction && <Button size="sm" variant="outline" onClick={onAction}>{actionLabel}</Button>}
    </section>
  );
}

function MovieHubHero({
  items,
  copy,
  world,
  states,
  statesReady,
}: {
  items: MovieHubItem[];
  copy: WorldCopy;
  world: MovieHubWorld;
  states?: Record<string, MediaBatchState>;
  statesReady: boolean;
}) {
  const goMovie = useNav((state) => state.goMovie);
  const reduceMotion = useReducedMotion();
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();
  const showWatchUndo = useWatchUndo();
  const [active, setActive] = useState(0);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const pointerStart = useRef<number | null>(null);
  const visibleItems = items.filter((item) => !dismissed.includes(item.id));
  const item = visibleItems[active % Math.max(visibleItems.length, 1)] ?? items[0];
  const state = states?.[mediaStateKey("movie", item.id)] ?? null;
  const inWatchlist = Boolean(state?.inWatchlist);
  const watched = Boolean(state?.watched);
  const title = getTitle(item);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`trakora:not-interested:${world}`) || "[]");
      if (Array.isArray(saved)) setDismissed(saved.map(Number).filter(Number.isFinite));
    } catch {
      setDismissed([]);
    }
  }, [world]);

  useEffect(() => {
    if (visibleItems.length < 2) return;
    const timer = window.setTimeout(() => setActive((value) => (value + 1) % visibleItems.length), 8000);
    return () => window.clearTimeout(timer);
  }, [active, visibleItems.length]);

  const payload = {
    tmdbId: item.id,
    title,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    releaseDate: item.release_date,
    voteAverage: item.vote_average,
    overview: item.overview,
    runtime: item.runtime,
    originalLanguage: item.original_language,
    originCountry: item.origin_country,
  };

  const toggleWatchlist = async () => {
    if (!statesReady) return;
    try {
      await watchlistToggle.mutateAsync({ ...payload, mediaType: "movie", action: inWatchlist ? "remove" : "add" });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update watchlist");
    }
  };

  const toggleWatched = async () => {
    if (!statesReady) return;
    if (!watched) {
      setRatingOpen(true);
      return;
    }
    try {
      const result = await watchedToggle.mutateAsync({ ...payload, action: "remove" });
      showWatchUndo("Removed from watched", result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update watched status");
    }
  };

  const dismiss = () => {
    const next = [...new Set([...dismissed, item.id])];
    const remaining = items.filter((candidate) => !next.includes(candidate.id));
    const saved = remaining.length > 0 ? next : [];
    setDismissed(saved);
    setActive(0);
    localStorage.setItem(`trakora:not-interested:${world}`, JSON.stringify(saved));
    toast.success("This title will not be suggested in the spotlight.");
  };

  const move = (direction: -1 | 1) => {
    setActive((value) => (value + direction + visibleItems.length) % visibleItems.length);
  };

  return (
    <motion.section
      className="tvtime-movie-hub-hero"
      aria-roledescription="carousel"
      aria-label={`${copy.featured}: ${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onPointerDown={(event) => { if (event.pointerType === "touch") pointerStart.current = event.clientX; }}
      onPointerUp={(event) => {
        if (pointerStart.current == null || event.pointerType !== "touch") return;
        const distance = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(distance) > 48) move(distance > 0 ? -1 : 1);
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={`hub-backdrop-${item.id}`}
          className="tvtime-movie-hub-hero__backdrop"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          <SafeImage src={img(item.backdrop_path, "original")} alt="" fill variant="backdrop" priority sizes="100vw" />
        </motion.div>
      </AnimatePresence>
      <div className="tvtime-movie-hub-hero__scrim" aria-hidden="true" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`hub-copy-${item.id}`}
          className="tvtime-movie-hub-hero__content"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
        >
          <div className="tvtime-movie-hub-hero__meta">
            <span><Sparkles /> {copy.featured}</span>
            {getYear(item) && <span>{getYear(item)}</span>}
            {item.runtime ? <span>{item.runtime} min</span> : null}
            {item.vote_average > 0 && <span><Star className="fill-current" /> {item.vote_average.toFixed(1)}</span>}
          </div>
          <h2>{title}</h2>
          <p className="line-clamp-2">{item.overview}</p>
          <div className="tvtime-movie-hub-hero__actions">
            <Button size="lg" onClick={() => goMovie(item.id)}><Play className="fill-current" /> {copy.viewDetails}</Button>
            <Button size="lg" className="tvtime-movie-hub-hero__watchlist" variant="outline" onClick={() => void toggleWatchlist()} disabled={!statesReady || watchlistToggle.isPending}>
              <Bookmark className={inWatchlist ? "fill-current" : ""} /> {inWatchlist ? copy.inWatchlist : copy.addWatchlist}
            </Button>
            <Button size="lg" variant="outline" onClick={() => void toggleWatched()} disabled={!statesReady || watchedToggle.isPending}>
              <Check /> {watched ? copy.watched : copy.markWatched}
            </Button>
          </div>
          <button type="button" className="tvtime-movie-hub-hero__dismiss" onClick={dismiss}><EyeOff /> {copy.notInterested}</button>
        </motion.div>
      </AnimatePresence>

      {visibleItems.length > 1 && (
        <div className="tvtime-movie-hub-hero__controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous featured movie"><ChevronLeft /></button>
          <div>
            {visibleItems.map((candidate, index) => (
              <button key={candidate.id} type="button" data-active={index === active ? "true" : "false"} onClick={() => setActive(index)} aria-label={`Show ${getTitle(candidate)}`} />
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next featured movie"><ChevronRight /></button>
        </div>
      )}

      <RatingDialog
        open={ratingOpen}
        onOpenChange={setRatingOpen}
        title={title}
        poster={imgOrPlaceholder(item.poster_path, "w185")}
        initialRating={state?.userRating ?? null}
        description="Choose your rating out of 100 to mark this movie watched. Cancelling leaves it unchanged."
        submitLabel="Save rating & mark watched"
        successMessage={(rating) => `Marked as watched · Your rating ${rating}/100`}
        onRate={(userRating) => watchedToggle.mutateAsync({ ...payload, action: "add", userRating })}
      />
    </motion.section>
  );
}

function MovieHubSkeleton() {
  return (
    <div className="tvtime-movie-hub__skeleton" role="status" aria-busy="true" aria-label="Loading movie hub">
      <span className="sr-only">Loading movie hub…</span>
      <div className="h-[clamp(22rem,48vw,34rem)] rounded-[1.5rem] shimmer" />
      {Array.from({ length: 4 }).map((_, section) => (
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
