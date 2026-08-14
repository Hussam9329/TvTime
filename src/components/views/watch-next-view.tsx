"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheckBig,
  Clock3,
  Eye,
  Flame,
  GripVertical,
  ListRestart,
  PauseCircle,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SafeImage } from "@/components/media/safe-image";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { useEpisodeImages, useEpisodeToggle, useSeasonDetail, useTvDetail } from "@/hooks/use-tmdb";
import { useMobileViewport } from "@/hooks/use-mobile-viewport";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import { useNav } from "@/lib/store";
import { img } from "@/lib/tmdb";
import { userHeaders, withUserId } from "@/lib/client-user";
import { toast } from "sonner";

const CUSTOM_ORDER_KEY = "trakora:watch-next-order:v1";
const PAUSED_DAYS = 30;

type WatchNextItem = {
  tmdbId: number;
  title: string;
  poster: string | null;
  showBackdrop: string | null;
  seasonBackdrop: string | null;
  seasonNumber: number;
  episodeNumber: number;
  followingSeasonNumber: number | null;
  followingEpisodeNumber: number | null;
  readyEpisodes: number;
  watchedEpisodes: number;
  releasedEpisodes: number;
  estimatedRuntime: number;
  lastActivity: string;
  lastWatchedAt: string | null;
  status: string | null;
  isAnime: boolean;
  isArabic: boolean;
  episodeName: string | null;
  episodeAirDate: string | null;
  episodeRuntime: number | null;
  episodeStill: string | null;
  episodeStillRanked: boolean;
  isNewEpisode: boolean;
  isSeasonFinale: boolean;
  nextSeasonNumber: number | null;
  lastSeasonNumber: number | null;
  followingEpisodeName: string | null;
  followingEpisodeAirDate: string | null;
  followingEpisodeRuntime: number | null;
  followingEpisodeStill: string | null;
};

type EnrichedWatchNextItem = WatchNextItem;

type UpcomingItem = {
  tmdbId: number;
  title: string;
  poster: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  airDate: string;
  estimatedRuntime: number;
  isAnime: boolean;
  isArabic: boolean;
};

type UpToDateItem = {
  tmdbId: number;
  title: string;
  poster: string | null;
  watchedEpisodes: number;
  releasedEpisodes: number;
  lastActivity: string;
  status: string | null;
  isAnime: boolean;
  isArabic: boolean;
};

type WatchNextResponse = {
  items: WatchNextItem[];
  upcoming: UpcomingItem[];
  upToDate: UpToDateItem[];
  summary: { readyEpisodes: number; estimatedMinutes: number };
};

type SeasonCompletionState = Pick<WatchNextItem,
  "tmdbId" | "title" | "poster" | "showBackdrop" | "seasonNumber" | "nextSeasonNumber" | "isAnime" | "isArabic"
>;

export function WatchNextView() {
  const goTv = useNav((state) => state.goTv);
  const episodeToggle = useEpisodeToggle();
  const showWatchUndo = useWatchUndo();
  const [manualOrder, setManualOrder] = useState<number[] | null>(null);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [deferredIds, setDeferredIds] = useState<number[]>([]);
  const [seasonCompletion, setSeasonCompletion] = useState<SeasonCompletionState | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CUSTOM_ORDER_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      if (Array.isArray(parsed)) {
        setManualOrder(parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0));
      }
    } catch {
      window.localStorage.removeItem(CUSTOM_ORDER_KEY);
    }
  }, []);

  const query = useQuery({
    queryKey: ["watch-next"],
    queryFn: async () => {
      const response = await fetch(withUserId(new URL("/api/watch-next", window.location.origin)), { headers: userHeaders() });
      if (!response.ok) throw new Error("Failed to build Watch Next");
      return response.json() as Promise<WatchNextResponse>;
    },
    staleTime: 60_000,
  });

  const items = query.data?.items ?? [];
  const smartItems = [...items].sort((left, right) =>
    smartPriority(right) - smartPriority(left)
    || Date.parse(right.lastActivity) - Date.parse(left.lastActivity));
  const orderIndex = new Map<number, number>((manualOrder ?? []).map((id, index) => [id, index] as const));
  const baseOrderedItems = manualOrder
    ? [...smartItems].sort((left, right) =>
        (orderIndex.get(left.tmdbId) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(right.tmdbId) ?? Number.MAX_SAFE_INTEGER)
        || smartPriority(right) - smartPriority(left))
    : smartItems;
  const deferred = new Set(deferredIds);
  const orderedItems = [
    ...baseOrderedItems.filter((item) => !deferred.has(item.tmdbId)),
    ...baseOrderedItems.filter((item) => deferred.has(item.tmdbId)),
  ];
  const featured = orderedItems[0] ?? null;
  const remainingItems = orderedItems.slice(1);
  const sections = categorizeItems(remainingItems);

  const markWatched = async (item: EnrichedWatchNextItem) => {
    try {
      const result = await episodeToggle.mutateAsync({
        action: "add",
        showId: item.tmdbId,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeName: item.episodeName || undefined,
      });
      if (item.isSeasonFinale) {
        setSeasonCompletion({
          tmdbId: item.tmdbId,
          title: item.title,
          poster: item.poster,
          showBackdrop: item.showBackdrop,
          seasonNumber: item.seasonNumber,
          nextSeasonNumber: item.nextSeasonNumber,
          isAnime: item.isAnime,
          isArabic: item.isArabic,
        });
      }
      showWatchUndo(`${episodeCode(item)} watched — your queue is updated`, result, {
        onUndoSuccess: () => {
          setSeasonCompletion((current) => current?.tmdbId === item.tmdbId && current.seasonNumber === item.seasonNumber ? null : current);
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark episode watched");
    }
  };

  const openCustomize = () => {
    setDraftOrder(orderedItems.map((item) => item.tmdbId));
    setIsCustomizing(true);
  };

  const saveCustomOrder = () => {
    setManualOrder(draftOrder);
    window.localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(draftOrder));
    setDeferredIds([]);
    setIsCustomizing(false);
    toast.success("Your Watch Next order was saved");
  };

  const resetSmartOrder = () => {
    window.localStorage.removeItem(CUSTOM_ORDER_KEY);
    setManualOrder(null);
    setDeferredIds([]);
    setIsCustomizing(false);
    toast.success("Smart priority restored");
  };

  const notNow = (item: EnrichedWatchNextItem) => {
    if (manualOrder) {
      const nextOrder = [...manualOrder.filter((id) => id !== item.tmdbId), item.tmdbId];
      setManualOrder(nextOrder);
      window.localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(nextOrder));
    } else {
      setDeferredIds((current) => [...current.filter((id) => id !== item.tmdbId), item.tmdbId]);
    }
    toast.success(`${item.title} moved to the end for now`);
  };

  const isPending = (item: WatchNextItem) => episodeToggle.isPending && episodeToggle.variables?.showId === item.tmdbId;
  const summary = query.data?.summary ?? { readyEpisodes: 0, estimatedMinutes: 0 };

  return (
    <div className="tvtime-watch-next-page space-y-5">
      <PageTitlebar title="Watch Next" />

      {query.isLoading ? <WatchNextSkeleton /> : query.isError ? (
        <EmptyState
          className="feedback-state--error"
          icon={<Clock3 className="h-9 w-9" />}
          title="Your queue couldn't be loaded"
          description="Your progress is safe. Check your connection and try loading Watch Next again."
          action={<Button variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <QueueSummary
            readyEpisodes={summary.readyEpisodes}
            estimatedMinutes={summary.estimatedMinutes}
            customOrderActive={manualOrder !== null}
            isCustomizing={isCustomizing}
            onCustomize={openCustomize}
          />

          {isCustomizing ? (
            <OrderEditor
              items={orderedItems}
              order={draftOrder}
              onReorder={setDraftOrder}
              onSave={saveCustomOrder}
              onCancel={() => setIsCustomizing(false)}
              onReset={resetSmartOrder}
            />
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {seasonCompletion ? (
                <SeasonCompletionCard
                  key={`season-complete-${seasonCompletion.tmdbId}-${seasonCompletion.seasonNumber}`}
                  completion={seasonCompletion}
                  onOpenShow={() => goTv(seasonCompletion.tmdbId)}
                  onContinue={() => setSeasonCompletion(null)}
                  onOpenSimilar={goTv}
                />
              ) : featured && (
                <FeaturedWatchCard
                  key="featured"
                  item={featured}
                  pending={isPending(featured)}
                  disabled={episodeToggle.isPending}
                  onMark={(completion) => void markWatched({
                    ...featured,
                    isSeasonFinale: completion?.isSeasonFinale ?? featured.isSeasonFinale,
                    nextSeasonNumber: completion?.nextSeasonNumber ?? featured.nextSeasonNumber,
                  })}
                  onOpen={() => goTv(featured.tmdbId)}
                  onNotNow={() => notNow(featured)}
                />
              )}

              {orderedItems.length === 0 && query.data?.upcoming.length === 0 && query.data?.upToDate.length === 0 && (
                <EmptyReady key="empty" />
              )}

              <WatchSection
                key="continue"
                icon={<Play className="h-4 w-4" />}
                title="Continue Watching"
                subtitle="Shows you have already started"
                items={sections.continueWatching}
                episodeTogglePending={episodeToggle.isPending}
                pendingId={episodeToggle.variables?.showId}
                onMark={markWatched}
                onOpen={goTv}
                onNotNow={notNow}
                rail
              />
              <WatchSection
                key="new"
                icon={<Sparkles className="h-4 w-4" />}
                title="New Episodes"
                subtitle="Episodes released after your last watch"
                items={sections.newEpisodes}
                episodeTogglePending={episodeToggle.isPending}
                pendingId={episodeToggle.variables?.showId}
                onMark={markWatched}
                onOpen={goTv}
                onNotNow={notNow}
                tone="new"
              />
              <WatchSection
                key="behind"
                icon={<Flame className="h-4 w-4" />}
                title="Falling Behind"
                subtitle="Shows with a growing episode backlog"
                items={sections.fallingBehind}
                episodeTogglePending={episodeToggle.isPending}
                pendingId={episodeToggle.variables?.showId}
                onMark={markWatched}
                onOpen={goTv}
                onNotNow={notNow}
                tone="behind"
              />
              <UpToDateSection key="up-to-date" items={query.data?.upToDate ?? []} onOpen={goTv} />
              <UpcomingSection key="coming-soon" items={query.data?.upcoming ?? []} onOpen={goTv} />
              <WatchSection
                key="paused"
                icon={<PauseCircle className="h-4 w-4" />}
                title="Paused"
                subtitle="No episode activity for 30 days or more"
                items={sections.paused}
                episodeTogglePending={episodeToggle.isPending}
                pendingId={episodeToggle.variables?.showId}
                onMark={markWatched}
                onOpen={goTv}
                onNotNow={notNow}
                tone="paused"
              />
            </AnimatePresence>
          )}
        </>
      )}
    </div>
  );
}

function QueueSummary({
  readyEpisodes,
  estimatedMinutes,
  customOrderActive,
  isCustomizing,
  onCustomize,
}: {
  readyEpisodes: number;
  estimatedMinutes: number;
  customOrderActive: boolean;
  isCustomizing: boolean;
  onCustomize: () => void;
}) {
  return (
    <div className="tvtime-watch-summary">
      <div className="tvtime-watch-summary__copy">
        <span className="tvtime-watch-summary__icon"><Timer className="h-4 w-4" /></span>
        <strong>{readyEpisodes === 1 ? "1 episode ready" : `${readyEpisodes} episodes ready`}</strong>
        <span aria-hidden="true">•</span>
        <span>{formatReadyTime(estimatedMinutes)} estimated</span>
      </div>
      {!isCustomizing && (
        <Button type="button" variant="outline" size="sm" className="tvtime-watch-summary__customize" onClick={onCustomize}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Customize order
          {customOrderActive && <span className="tvtime-watch-summary__saved" aria-label="Custom order active" />}
        </Button>
      )}
    </div>
  );
}

function FeaturedWatchCard({
  item,
  pending,
  disabled,
  onMark,
  onOpen,
  onNotNow,
}: {
  item: EnrichedWatchNextItem;
  pending: boolean;
  disabled: boolean;
  onMark: (completion?: { isSeasonFinale: boolean; nextSeasonNumber: number | null }) => void;
  onOpen: () => void;
  onNotNow: () => void;
}) {
  const isMobile = useMobileViewport();
  const swipeRef = useRef(false);
  const needsSeasonFallback = !item.episodeStill
    || !item.seasonBackdrop
    || (item.followingSeasonNumber === item.seasonNumber && (!item.followingEpisodeName || !item.followingEpisodeStill));
  const seasonQuery = useSeasonDetail(
    needsSeasonFallback ? item.tmdbId : null,
    needsSeasonFallback ? item.seasonNumber : null,
  );
  const episodeImagesQuery = useEpisodeImages(
    item.episodeStillRanked ? null : item.tmdbId,
    item.episodeStillRanked ? null : item.seasonNumber,
    item.episodeStillRanked ? null : item.episodeNumber,
  );
  const followingNeedsLookup = item.followingSeasonNumber != null
    && item.followingEpisodeNumber != null
    && (!item.followingEpisodeName || !item.followingEpisodeStill)
    && item.followingSeasonNumber !== item.seasonNumber;
  const followingSeasonQuery = useSeasonDetail(
    followingNeedsLookup ? item.tmdbId : null,
    followingNeedsLookup ? item.followingSeasonNumber : null,
  );

  const resolvedEpisode = seasonQuery.data?.episodes?.find((episode) =>
    episode.season_number === item.seasonNumber
    && episode.episode_number === item.episodeNumber);
  const bestStill = pickBestStillClient(episodeImagesQuery.data?.stills)
    || item.episodeStill
    || (resolvedEpisode?.still_path ? img(resolvedEpisode.still_path, "original") : null);
  const resolvedEpisodeStill = bestStill;
  const resolvedSeasonBackdrop = item.seasonBackdrop || pickSeasonBackdropClient(seasonQuery.data, item.episodeNumber);
  const needsShowFallback = !bestStill && !resolvedSeasonBackdrop && !item.showBackdrop;
  const showQuery = useTvDetail(needsShowFallback ? item.tmdbId : null);
  const showBackdrop = item.showBackdrop
    || (showQuery.data?.backdrop_path ? img(showQuery.data.backdrop_path, "original") : null);
  const backdrop = resolvedEpisodeStill || resolvedSeasonBackdrop || showBackdrop || item.poster;
  const imageKind = resolvedEpisodeStill
    ? "episode-still"
    : resolvedSeasonBackdrop
      ? "season-backdrop"
      : showBackdrop
        ? "show-backdrop"
        : "poster-fallback";

  const currentSeasonForFollowing = item.followingSeasonNumber === item.seasonNumber ? seasonQuery.data : null;
  const followingSeason = currentSeasonForFollowing || followingSeasonQuery.data;
  const resolvedFollowing = followingSeason?.episodes?.find((episode) =>
    episode.season_number === item.followingSeasonNumber
    && episode.episode_number === item.followingEpisodeNumber);
  const followingName = item.followingEpisodeName || resolvedFollowing?.name || (
    item.followingEpisodeNumber != null ? `Episode ${item.followingEpisodeNumber}` : null
  );
  const followingStill = item.followingEpisodeStill
    || (resolvedFollowing?.still_path ? img(resolvedFollowing.still_path, "original") : null)
    || resolvedSeasonBackdrop
    || showBackdrop
    || item.poster;
  const followingRuntime = item.followingEpisodeRuntime || resolvedFollowing?.runtime || item.estimatedRuntime;
  const followingAirDate = item.followingEpisodeAirDate || resolvedFollowing?.air_date || null;

  const progress = progressPercent(item);
  const episodeName = item.episodeName || resolvedEpisode?.name || `Episode ${item.episodeNumber}`;
  const runtime = item.episodeRuntime || resolvedEpisode?.runtime || item.estimatedRuntime;
  const airDate = item.episodeAirDate || resolvedEpisode?.air_date || null;
  const regularSeasonEpisodes = (seasonQuery.data?.episodes ?? []).filter((episode) => episode.episode_number > 0);
  const seasonLastEpisode = regularSeasonEpisodes.length > 0
    ? Math.max(...regularSeasonEpisodes.map((episode) => episode.episode_number))
    : null;
  const resolvedIsSeasonFinale = item.isSeasonFinale || seasonLastEpisode === item.episodeNumber;
  const resolvedNextSeasonNumber = item.nextSeasonNumber ?? (
    resolvedIsSeasonFinale && item.lastSeasonNumber != null && item.seasonNumber < item.lastSeasonNumber
      ? item.seasonNumber + 1
      : null
  );
  const resolvedIsNewEpisode = item.isNewEpisode || isEpisodeNewSinceLastWatch(airDate, item.lastWatchedAt, item.watchedEpisodes);

  const handleSwipeEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (!isMobile || disabled) return;
    if (info.offset.x >= 88) onMark({ isSeasonFinale: resolvedIsSeasonFinale, nextSeasonNumber: resolvedNextSeasonNumber });
    else if (info.offset.x <= -88) onNotNow();
    window.setTimeout(() => { swipeRef.current = false; }, 0);
  };
  const handleOpen = () => {
    if (!swipeRef.current) onOpen();
  };

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.22 }}
      drag={isMobile && !disabled ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.14}
      dragSnapToOrigin
      onDragStart={() => { swipeRef.current = true; }}
      onDragEnd={handleSwipeEnd}
      whileDrag={isMobile ? { scale: 0.995 } : undefined}
      className="tvtime-watch-featured"
      aria-labelledby={`watch-featured-${item.tmdbId}`}
      style={isMobile ? { touchAction: "pan-y" } : undefined}
    >
      <span className="tvtime-watch-swipe-hint is-right" aria-hidden="true"><CheckCircle2 /> Watched</span>
      <span className="tvtime-watch-swipe-hint is-left" aria-hidden="true"><PauseCircle /> Not now</span>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={backdrop || `poster-${item.tmdbId}`}
          className="tvtime-watch-featured__backdrop-stage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.46, ease: "easeOut" }}
          aria-hidden="true"
        >
          <div className="tvtime-watch-featured__backdrop-blur" data-image-kind={imageKind}>
            <SafeImage
              src={backdrop}
              alt=""
              fill
              variant="backdrop"
              priority
              fetchPriority="high"
              decoding="async"
              sizes="(max-width: 768px) 100vw, (max-width: 1440px) 92vw, 1440px"
            />
          </div>
          <div className="tvtime-watch-featured__backdrop" data-image-kind={imageKind}>
            <SafeImage
              src={backdrop}
              alt=""
              fill
              variant="backdrop"
              priority
              fetchPriority="high"
              decoding="async"
              sizes="(max-width: 768px) 100vw, (max-width: 1440px) 92vw, 1440px"
            />
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="tvtime-watch-featured__scrim" />
      <div className="tvtime-watch-featured__content">
        <div className="tvtime-watch-featured__eyebrow">
          <span>Up next</span>
          {resolvedIsNewEpisode && <NewEpisodeBadge />}
          <PersonalStatus item={item} />
        </div>
        <h2 id={`watch-featured-${item.tmdbId}`}>{item.title}</h2>
        <p className="tvtime-watch-featured__episode">
          <strong>{episodeCode(item)}</strong>
          <span aria-hidden="true">—</span>
          <span>{episodeName}</span>
        </p>
        <div className="tvtime-watch-featured__meta">
          <span><Clock3 className="h-3.5 w-3.5" />{runtime}m</span>
          <span><CalendarDays className="h-3.5 w-3.5" />{releasedLabel(airDate)}</span>
          <span>{item.readyEpisodes === 1 ? "1 episode ready" : `${item.readyEpisodes} episodes ready`}</span>
          {resolvedIsSeasonFinale && <span className="tvtime-watch-finale-label"><Sparkles /> Season finale</span>}
        </div>
        <ProgressBar item={item} progress={progress} runtime={runtime} featured />
        <NextEpisodePreview
          item={item}
          name={followingName}
          still={followingStill}
          runtime={followingRuntime}
          airDate={followingAirDate}
          onOpen={handleOpen}
        />
        <div className="tvtime-watch-featured__actions">
          <Button type="button" onClick={() => onMark({ isSeasonFinale: resolvedIsSeasonFinale, nextSeasonNumber: resolvedNextSeasonNumber })} disabled={disabled} className="tvtime-watch-featured__primary">
            <CheckCircle2 className={pending ? "animate-pulse" : ""} />
            {pending ? "Updating…" : "Mark episode watched"}
          </Button>
          <Button type="button" variant="outline" onClick={handleOpen} className="tvtime-watch-featured__secondary">
            <Eye /> View episode
          </Button>
          <Button type="button" variant="ghost" onClick={onNotNow} className="tvtime-watch-featured__later">
            Not now
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

function NextEpisodePreview({
  item,
  name,
  still,
  runtime,
  airDate,
  onOpen,
}: {
  item: EnrichedWatchNextItem;
  name: string | null;
  still: string | null;
  runtime: number;
  airDate: string | null;
  onOpen: () => void;
}) {
  if (item.followingSeasonNumber == null || item.followingEpisodeNumber == null) return null;
  const code = episodeCode({ seasonNumber: item.followingSeasonNumber, episodeNumber: item.followingEpisodeNumber });
  const isUpcoming = Boolean(airDate && airDate > new Date().toISOString().slice(0, 10));
  return (
    <button type="button" className="tvtime-watch-next-episode" onClick={onOpen} aria-label={`View ${code} ${name || "next episode"}`}>
      <span className="tvtime-watch-next-episode__thumb">
        <SafeImage src={still} alt="" fill variant="still" sizes="128px" />
      </span>
      <span className="tvtime-watch-next-episode__copy">
        <small>{isUpcoming ? "Coming next" : "Next after this"}</small>
        <strong>{code} <span>—</span> {name || `Episode ${item.followingEpisodeNumber}`}</strong>
        <span>{runtime}m{airDate ? ` • ${isUpcoming ? formatAirDate(airDate) : releasedLabel(airDate)}` : ""}</span>
      </span>
      <Eye className="tvtime-watch-next-episode__icon" />
    </button>
  );
}

function NewEpisodeBadge() {
  return <span className="tvtime-watch-new-badge"><Sparkles />New</span>;
}

function SeasonCompletionCard({
  completion,
  onOpenShow,
  onContinue,
  onOpenSimilar,
}: {
  completion: SeasonCompletionState;
  onOpenShow: () => void;
  onContinue: () => void;
  onOpenSimilar: (id: number) => void;
}) {
  const nextSeasonQuery = useSeasonDetail(
    completion.nextSeasonNumber != null ? completion.tmdbId : null,
    completion.nextSeasonNumber,
  );
  const similarQuery = useTvDetail(completion.nextSeasonNumber == null ? completion.tmdbId : null);
  const firstNextEpisode = nextSeasonQuery.data?.episodes?.find((episode) => episode.episode_number > 0) || null;
  const nextSeasonArtwork = firstNextEpisode?.still_path
    ? img(firstNextEpisode.still_path, "original")
    : nextSeasonQuery.data?.poster_path
      ? img(nextSeasonQuery.data.poster_path, "w500")
      : completion.showBackdrop || completion.poster;
  const similarItems = ((((similarQuery.data as any)?.recommendations?.results ?? []) as Array<any>)
    .filter((item) => Number(item?.id) > 0 && Number(item.id) !== completion.tmdbId));
  const similar = similarItems[0] ?? null;
  const similarArtwork = similar?.backdrop_path
    ? img(similar.backdrop_path, "w780")
    : similar?.poster_path
      ? img(similar.poster_path, "w500")
      : null;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.99 }}
      className="tvtime-watch-season-complete"
    >
      <div className="tvtime-watch-season-complete__artwork">
        <SafeImage
          src={completion.nextSeasonNumber != null ? nextSeasonArtwork : similarArtwork || completion.showBackdrop || completion.poster}
          alt=""
          fill
          variant="backdrop"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      <div className="tvtime-watch-season-complete__scrim" />
      <div className="tvtime-watch-season-complete__content">
        <span className="tvtime-watch-season-complete__badge"><CircleCheckBig />Season complete</span>
        <h2>{completion.title}</h2>
        <p>You finished Season {completion.seasonNumber}.</p>
        {completion.nextSeasonNumber != null ? (
          <div className="tvtime-watch-season-complete__suggestion">
            <span className="tvtime-watch-season-complete__thumb">
              <SafeImage src={nextSeasonArtwork} alt="" fill variant={firstNextEpisode?.still_path ? "still" : "poster"} sizes="132px" />
            </span>
            <span>
              <small>Continue the story</small>
              <strong>Season {completion.nextSeasonNumber}</strong>
              <em>{firstNextEpisode ? `${episodeCode(firstNextEpisode)} — ${firstNextEpisode.name || `Episode ${firstNextEpisode.episode_number}`}` : "The next season is ready when you are"}</em>
            </span>
          </div>
        ) : similar ? (
          <button type="button" className="tvtime-watch-season-complete__suggestion is-clickable" onClick={() => onOpenSimilar(Number(similar.id))}>
            <span className="tvtime-watch-season-complete__thumb">
              <SafeImage src={similarArtwork} alt="" fill variant={similar?.backdrop_path ? "still" : "poster"} sizes="132px" />
            </span>
            <span>
              <small>Try something similar</small>
              <strong>{similar.name || similar.title || "Recommended show"}</strong>
              <em>Based on this series</em>
            </span>
          </button>
        ) : (
          <p className="tvtime-watch-season-complete__quiet">You’re caught up. Open the show for recommendations and similar titles.</p>
        )}
        <div className="tvtime-watch-season-complete__actions">
          <Button type="button" onClick={completion.nextSeasonNumber != null ? onOpenShow : similar ? () => onOpenSimilar(Number(similar.id)) : onOpenShow}>
            <Play />{completion.nextSeasonNumber != null ? `Open Season ${completion.nextSeasonNumber}` : similar ? "View recommendation" : "Explore recommendations"}
          </Button>
          <Button type="button" variant="outline" onClick={onContinue}>Continue queue</Button>
        </div>
      </div>
    </motion.section>
  );
}

function WatchSection({
  icon,
  title,
  subtitle,
  items,
  episodeTogglePending,
  pendingId,
  onMark,
  onOpen,
  onNotNow,
  tone = "default",
  rail = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: EnrichedWatchNextItem[];
  episodeTogglePending: boolean;
  pendingId?: number;
  onMark: (item: EnrichedWatchNextItem) => Promise<void>;
  onOpen: (id: number) => void;
  onNotNow: (item: EnrichedWatchNextItem) => void;
  tone?: "default" | "new" | "behind" | "paused";
  rail?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <motion.section layout className="tvtime-watch-section" data-tone={tone} data-layout={rail ? "rail" : "grid"}>
      <SectionHeading icon={icon} title={title} subtitle={subtitle} count={items.length} />
      <div className="tvtime-watch-card-grid">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <CompactWatchCard
              key={item.tmdbId}
              item={item}
              disabled={episodeTogglePending}
              pending={episodeTogglePending && pendingId === item.tmdbId}
              onMark={() => void onMark(item)}
              onOpen={() => onOpen(item.tmdbId)}
              onNotNow={() => onNotNow(item)}
              tone={tone}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function CompactWatchCard({
  item,
  disabled,
  pending,
  onMark,
  onOpen,
  onNotNow,
  tone,
}: {
  item: EnrichedWatchNextItem;
  disabled: boolean;
  pending: boolean;
  onMark: () => void;
  onOpen: () => void;
  onNotNow: () => void;
  tone: "default" | "new" | "behind" | "paused";
}) {
  const isMobile = useMobileViewport();
  const swipeRef = useRef(false);
  // Compact cards stay query-free: the server enriches the smartest visible
  // items in one bounded batch, then this chain falls back without N+1 calls.
  const artwork = item.episodeStill || item.seasonBackdrop || item.showBackdrop || item.poster;
  const imageKind = item.episodeStill
    ? "episode-still"
    : item.seasonBackdrop
      ? "season-backdrop"
      : item.showBackdrop
        ? "show-backdrop"
        : "poster-fallback";
  const progress = progressPercent(item);
  const episodeName = item.episodeName || `Episode ${item.episodeNumber}`;
  const runtime = item.episodeRuntime || item.estimatedRuntime;

  const handleSwipeEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (!isMobile || disabled) return;
    if (info.offset.x >= 76) onMark();
    else if (info.offset.x <= -76) onNotNow();
    window.setTimeout(() => { swipeRef.current = false; }, 0);
  };
  const handleOpen = () => {
    if (!swipeRef.current) onOpen();
  };

  return (
    <div className="tvtime-watch-swipe-shell">
      <span className="tvtime-watch-swipe-hint is-right" aria-hidden="true"><CheckCircle2 /> Watched</span>
      <span className="tvtime-watch-swipe-hint is-left" aria-hidden="true"><PauseCircle /> Not now</span>
      <motion.article
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        drag={isMobile && !disabled ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragSnapToOrigin
        onDragStart={() => { swipeRef.current = true; }}
        onDragEnd={handleSwipeEnd}
        whileDrag={isMobile ? { scale: 0.985 } : undefined}
        className="tvtime-watch-card"
        data-tone={tone}
        aria-busy={pending}
        style={isMobile ? { touchAction: "pan-y" } : undefined}
      >
        <button
          type="button"
          className="tvtime-watch-card__poster tvtime-watch-card__artwork"
          data-image-kind={imageKind}
          onClick={handleOpen}
          aria-label={`Open ${item.title}`}
        >
          <SafeImage
            src={artwork}
            alt={item.title}
            fill
            variant={imageKind === "poster-fallback" ? "poster" : "still"}
            sizes="(max-width: 479px) 42vw, (max-width: 1024px) 260px, 320px"
          />
          <span className="tvtime-watch-card__preview" aria-hidden="true">
            <strong>{episodeCode(item)}</strong>
            <span>{episodeName}</span>
            <small>{runtime}m • {formatReadyTime(remainingMinutes(item, runtime))} left</small>
          </span>
          {item.isNewEpisode && <NewEpisodeBadge />}
        </button>
        <div className="tvtime-watch-card__body">
          <div className="tvtime-watch-card__topline">
            <PersonalStatus item={item} />
            <span
              className="tvtime-watch-card__ready"
              title={item.readyEpisodes === 1 ? "1 episode ready" : `${item.readyEpisodes} episodes ready`}
            >
              {item.readyEpisodes === 1 ? "1 episode ready" : `${item.readyEpisodes} episodes ready`}
            </span>
          </div>
          <button type="button" className="tvtime-watch-card__title" onClick={handleOpen}>{item.title}</button>
          <p className="tvtime-watch-card__episode"><strong>{episodeCode(item)}</strong><span>—</span>{episodeName}</p>
          <div className="tvtime-watch-card__meta">
            <span><Clock3 />{runtime}m</span>
            <span><CalendarDays />{releasedLabel(item.episodeAirDate)}</span>
            {item.isSeasonFinale && <span><Sparkles />Season finale</span>}
            {tone === "paused" && <span><PauseCircle />{daysSince(item.lastActivity)}d away</span>}
          </div>
          <ProgressBar item={item} progress={progress} runtime={runtime} />
          <div className="tvtime-watch-card__actions">
            <Button type="button" size="sm" variant="outline" className="tvtime-watch-card__mark" onClick={onMark} disabled={disabled}>
              <CheckCircle2 className={pending ? "animate-pulse" : ""} />
              {pending ? "Updating…" : "Mark watched"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="tvtime-watch-card__details"
              onClick={handleOpen}
              aria-label={`View ${item.title} details`}
            >
              <Eye /> View
            </Button>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

function ProgressBar({
  item,
  progress,
  runtime,
  featured = false,
}: {
  item: WatchNextItem;
  progress: number;
  runtime: number;
  featured?: boolean;
}) {
  const remaining = remainingMinutes(item, runtime);
  return (
    <div className={featured ? "tvtime-watch-progress is-featured" : "tvtime-watch-progress"}>
      <div className="tvtime-watch-progress__copy">
        <span>{item.watchedEpisodes}/{item.releasedEpisodes} watched <em>• {formatReadyTime(remaining)} left</em></span>
        <strong>{progress}%</strong>
      </div>
      <div className="tvtime-watch-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <motion.span initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.32, ease: "easeOut" }} />
      </div>
    </div>
  );
}

function PersonalStatus({ item }: { item: Pick<WatchNextItem, "status" | "watchedEpisodes"> }) {
  if (item.watchedEpisodes <= 0 && item.status !== "watching") return null;
  return <span className="tvtime-watch-personal-status"><Play className="fill-current" />Watching</span>;
}

function UpToDateSection({ items, onOpen }: { items: UpToDateItem[]; onOpen: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="tvtime-watch-collapsible">
      <CollapsibleTrigger asChild>
        <button type="button" className="tvtime-watch-collapsible__trigger">
          <span className="tvtime-watch-section__icon is-complete"><CircleCheckBig /></span>
          <span className="min-w-0 flex-1 text-start">
            <strong>Up to Date</strong>
            <small>Every released episode is watched</small>
          </span>
          <Badge variant="secondary">{items.length}</Badge>
          <ChevronDown className={open ? "rotate-180" : ""} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="tvtime-watch-collapsible__content">
        {items.map((item) => (
          <button key={item.tmdbId} type="button" className="tvtime-watch-complete-row" onClick={() => onOpen(item.tmdbId)}>
            <span className="tvtime-watch-complete-row__poster"><SafeImage src={item.poster} alt="" fill variant="poster" sizes="48px" /></span>
            <span className="min-w-0 flex-1 text-start">
              <strong>{item.title}</strong>
              <small>{item.releasedEpisodes} released episodes watched</small>
            </span>
            <Check className="h-4 w-4 text-emerald-400" />
          </button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function UpcomingSection({ items, onOpen }: { items: UpcomingItem[]; onOpen: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="tvtime-watch-section" data-tone="upcoming">
      <SectionHeading
        icon={<CalendarClock className="h-4 w-4" />}
        title="Coming Soon"
        subtitle="The next confirmed episodes for shows with no backlog"
        count={items.length}
      />
      <div className="tvtime-watch-upcoming-grid">
        {items.map((item) => (
          <button key={item.tmdbId} type="button" className="tvtime-watch-upcoming-card" onClick={() => onOpen(item.tmdbId)}>
            <span className="tvtime-watch-upcoming-card__poster"><SafeImage src={item.poster} alt="" fill variant="poster" sizes="72px" /></span>
            <span className="tvtime-watch-upcoming-card__copy">
              <strong>{item.title}</strong>
              <span>{episodeCode(item)}{item.episodeName ? ` — ${item.episodeName}` : ""}</span>
              <small><CalendarDays />{formatAirDate(item.airDate)}</small>
            </span>
            <span className="tvtime-watch-upcoming-card__countdown">{countdownLabel(item.airDate)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ icon, title, subtitle, count }: { icon: React.ReactNode; title: string; subtitle: string; count: number }) {
  return (
    <div className="tvtime-watch-section__heading">
      <span className="tvtime-watch-section__icon">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

function OrderEditor({
  items,
  order,
  onReorder,
  onSave,
  onCancel,
  onReset,
}: {
  items: EnrichedWatchNextItem[];
  order: number[];
  onReorder: (order: number[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const byId = new Map(items.map((item) => [item.tmdbId, item]));
  return (
    <section className="tvtime-watch-order-editor">
      <div className="tvtime-watch-order-editor__header">
        <div>
          <h2><ListRestart /> Customize your queue</h2>
          <p>Drag titles into your preferred order. The first title becomes the featured card.</p>
        </div>
        <div className="tvtime-watch-order-editor__actions">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}><RotateCcw /> Smart order</Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" onClick={onSave}><Check /> Save order</Button>
        </div>
      </div>
      <Reorder.Group axis="y" values={order} onReorder={onReorder} className="tvtime-watch-order-list">
        {order.map((id, index) => {
          const item = byId.get(id);
          return item ? <SortableOrderRow key={id} item={item} index={index} /> : null;
        })}
      </Reorder.Group>
    </section>
  );
}

function SortableOrderRow({ item, index }: { item: EnrichedWatchNextItem; index: number }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item.tmdbId} dragListener={false} dragControls={controls} className="tvtime-watch-order-row" whileDrag={{ scale: 1.015 }}>
      <span className="tvtime-watch-order-row__rank">{index + 1}</span>
      <span className="tvtime-watch-order-row__poster"><SafeImage src={item.poster} alt="" fill variant="poster" sizes="44px" /></span>
      <span className="min-w-0 flex-1">
        <strong>{item.title}</strong>
        <small>{episodeCode(item)} • {item.readyEpisodes} ready</small>
      </span>
      <button
        type="button"
        className="tvtime-watch-order-row__handle"
        aria-label={`Drag ${item.title} to reorder`}
        onPointerDown={(event) => controls.start(event)}
      >
        <GripVertical />
      </button>
    </Reorder.Item>
  );
}

function EmptyReady() {
  return (
    <EmptyState
      icon={<CheckCircle2 className="h-9 w-9 text-emerald-400" />}
      title="You’re all caught up"
      description="New released episodes will appear here automatically."
    />
  );
}

function WatchNextSkeleton() {
  return (
    <div className="tvtime-watch-skeleton" aria-label="Loading Watch Next">
      <div className="tvtime-watch-skeleton__summary shimmer" />
      <div className="tvtime-watch-skeleton__featured">
        <div className="tvtime-watch-skeleton__hero-image shimmer" />
        <div className="tvtime-watch-skeleton__hero-copy">
          <div className="h-4 w-24 shimmer rounded-full" />
          <div className="h-12 w-3/5 max-w-md shimmer rounded-xl" />
          <div className="h-5 w-2/5 max-w-xs shimmer rounded-lg" />
          <div className="h-3 w-full max-w-sm shimmer rounded-full" />
          <div className="h-11 w-56 max-w-full shimmer rounded-xl" />
        </div>
      </div>
      <div className="h-10 w-64 max-w-full shimmer rounded-lg" />
      <div className="tvtime-watch-card-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="tvtime-watch-skeleton__card">
            <div className="tvtime-watch-skeleton__card-art shimmer" />
            <div className="tvtime-watch-skeleton__card-copy">
              <div className="h-3 w-20 shimmer rounded-full" />
              <div className="h-5 w-4/5 shimmer rounded-lg" />
              <div className="h-3 w-3/5 shimmer rounded-full" />
              <div className="h-2 w-full shimmer rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function categorizeItems(items: EnrichedWatchNextItem[]) {
  const result = {
    continueWatching: [] as EnrichedWatchNextItem[],
    newEpisodes: [] as EnrichedWatchNextItem[],
    fallingBehind: [] as EnrichedWatchNextItem[],
    paused: [] as EnrichedWatchNextItem[],
  };
  for (const item of items) {
    if (item.isNewEpisode) {
      result.newEpisodes.push(item);
    } else if (daysSince(item.lastActivity) >= PAUSED_DAYS) {
      result.paused.push(item);
    } else if (item.readyEpisodes >= 3 || item.watchedEpisodes === 0) {
      result.fallingBehind.push(item);
    } else {
      result.continueWatching.push(item);
    }
  }
  return result;
}

function smartPriority(item: EnrichedWatchNextItem) {
  const activityAge = daysSince(item.lastActivity);
  const releaseAge = item.episodeAirDate ? daysSince(`${item.episodeAirDate}T00:00:00Z`) : Number.MAX_SAFE_INTEGER;
  const completionRatio = progressPercent(item) / 100;
  const completionBase = progressPercent(item) * 3;
  const nearCompletion = completionRatio >= 0.7 ? Math.round(completionRatio * 650) : 0;
  const newEpisode = item.isNewEpisode ? 1_250 : releaseAge <= 7 ? Math.max(0, 8 - releaseAge) * 70 : 0;
  const oneReady = item.readyEpisodes === 1 ? 540 : 0;
  // A long-neglected show gets a controlled comeback boost instead of being
  // buried forever. Cap it so a 3-year-old pause cannot dominate fresh TV.
  const returnBoost = activityAge >= 21 ? Math.min(520, (activityAge - 20) * 9) : 0;
  const recentMomentum = item.watchedEpisodes > 0 && activityAge < 14 ? (14 - activityAge) * 24 : 0;
  const backlogPenalty = Math.max(0, item.readyEpisodes - 4) * 32;
  return newEpisode + completionBase + nearCompletion + oneReady + returnBoost + recentMomentum - backlogPenalty;
}

function progressPercent(item: Pick<WatchNextItem, "watchedEpisodes" | "releasedEpisodes">) {
  return Math.min(100, Math.max(0, Math.round((item.watchedEpisodes / Math.max(item.releasedEpisodes, 1)) * 100)));
}

function remainingMinutes(item: Pick<WatchNextItem, "readyEpisodes" | "estimatedRuntime">, currentRuntime?: number | null) {
  if (item.readyEpisodes <= 0) return 0;
  const current = Math.max(1, Math.round(currentRuntime || item.estimatedRuntime || 1));
  const rest = Math.max(0, item.readyEpisodes - 1) * Math.max(1, Math.round(item.estimatedRuntime || current));
  return current + rest;
}

function episodeCode(item: { seasonNumber?: number; episodeNumber?: number; season_number?: number; episode_number?: number }) {
  const season = item.seasonNumber ?? item.season_number ?? 0;
  const episode = item.episodeNumber ?? item.episode_number ?? 0;
  return `S${String(season).padStart(2, "0")} E${String(episode).padStart(2, "0")}`;
}

function formatReadyTime(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function pickBestStillClient(stills: Array<{ aspect_ratio?: number; width?: number; height?: number; vote_average?: number; vote_count?: number; file_path?: string | null }> | null | undefined) {
  const best = [...(stills ?? [])]
    .filter((still) => Boolean(still.file_path))
    .sort((left, right) => clientStillScore(right) - clientStillScore(left))[0];
  return best?.file_path ? img(best.file_path, "original") : null;
}

function clientStillScore(still: { aspect_ratio?: number; width?: number; height?: number; vote_average?: number; vote_count?: number }) {
  const width = Math.max(1, Number(still.width) || 1);
  const height = Math.max(1, Number(still.height) || 1);
  const ratio = Number(still.aspect_ratio) > 0 ? Number(still.aspect_ratio) : width / height;
  const ratioPenalty = Math.abs(ratio - 16 / 9) * 1_800;
  const resolution = Math.min(width * height, 3_000_000) / 2_500;
  const votes = Math.max(0, Number(still.vote_average) || 0) * 24 + Math.min(50, Number(still.vote_count) || 0) * 2;
  return resolution + votes - ratioPenalty;
}

function pickSeasonBackdropClient(
  season: { episodes?: Array<{ episode_number: number; still_path: string | null; vote_average?: number }> } | null | undefined,
  currentEpisodeNumber: number,
) {
  const best = [...(season?.episodes ?? [])]
    .filter((episode) => Boolean(episode.still_path))
    .sort((left, right) => {
      const leftScore = Math.max(0, Number(left.vote_average) || 0) * 25 - Math.abs(left.episode_number - currentEpisodeNumber) * 1.2;
      const rightScore = Math.max(0, Number(right.vote_average) || 0) * 25 - Math.abs(right.episode_number - currentEpisodeNumber) * 1.2;
      return rightScore - leftScore;
    })[0];
  return best?.still_path ? img(best.still_path, "original") : null;
}

function isEpisodeNewSinceLastWatch(airDate: string | null | undefined, lastWatchedAt: string | null, watchedEpisodes: number) {
  if (!airDate || !lastWatchedAt || watchedEpisodes <= 0) return false;
  return airDate > lastWatchedAt.slice(0, 10);
}

function releasedLabel(value: string | null | undefined) {
  if (!value) return "Release date unavailable";
  const age = daysSince(`${value}T00:00:00Z`);
  if (age === 0) return "Released today";
  if (age === 1) return "Released yesterday";
  return `Released ${age} days ago`;
}

function formatAirDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)
    : value;
}

function countdownLabel(value: string) {
  const remaining = daysUntil(value);
  if (remaining === 0) return "Today";
  if (remaining === 1) return "Tomorrow";
  return `In ${remaining} days`;
}

function daysSince(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86_400_000)) : 0;
}

function daysUntil(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(time) ? Math.max(0, Math.ceil((time - today) / 86_400_000)) : 0;
}
