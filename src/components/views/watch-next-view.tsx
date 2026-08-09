"use client";

import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
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
import { useEpisodeToggle, useTvDetail } from "@/hooks/use-tmdb";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import { useNav } from "@/lib/store";
import { userHeaders, withUserId } from "@/lib/client-user";
import type { Episode, SeasonDetail } from "@/lib/tmdb";
import { toast } from "sonner";

const CUSTOM_ORDER_KEY = "trakora:watch-next-order:v1";
const RECENT_EPISODE_DAYS = 7;
const PAUSED_DAYS = 30;

type WatchNextItem = {
  tmdbId: number;
  title: string;
  poster: string | null;
  seasonNumber: number;
  episodeNumber: number;
  readyEpisodes: number;
  watchedEpisodes: number;
  releasedEpisodes: number;
  estimatedRuntime: number;
  lastActivity: string;
  status: string | null;
  isAnime: boolean;
  isArabic: boolean;
};

type EnrichedWatchNextItem = WatchNextItem & { episode: Episode | null };

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

export function WatchNextView() {
  const goTv = useNav((state) => state.goTv);
  const episodeToggle = useEpisodeToggle();
  const showWatchUndo = useWatchUndo();
  const [manualOrder, setManualOrder] = useState<number[] | null>(null);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [deferredIds, setDeferredIds] = useState<number[]>([]);

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

  const query = useQueries({
    queries: [{
      queryKey: ["watch-next"],
      queryFn: async () => {
        const response = await fetch(withUserId(new URL("/api/watch-next", window.location.origin)), { headers: userHeaders() });
        if (!response.ok) throw new Error("Failed to build Watch Next");
        return response.json() as Promise<WatchNextResponse>;
      },
      staleTime: 60_000,
    }],
  })[0];

  const items = query.data?.items ?? [];
  const seasonQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["tmdb", "tv", item.tmdbId, "season", item.seasonNumber],
      queryFn: async () => {
        const response = await fetch(`/api/tmdb/tv/${item.tmdbId}/season/${item.seasonNumber}`);
        if (!response.ok) throw new Error("Episode details unavailable");
        return response.json() as Promise<SeasonDetail>;
      },
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  const enrichedItems: EnrichedWatchNextItem[] = items.map((item, index) => ({
    ...item,
    episode: seasonQueries[index]?.data?.episodes?.find((episode) =>
      episode.season_number === item.seasonNumber && episode.episode_number === item.episodeNumber) ?? null,
  }));
  const episodeDetailsSettled = seasonQueries.every((seasonQuery) => !seasonQuery.isPending);
  const smartItems = [...enrichedItems].sort((left, right) =>
    smartPriority(right, episodeDetailsSettled) - smartPriority(left, episodeDetailsSettled)
    || Date.parse(right.lastActivity) - Date.parse(left.lastActivity));
  const orderIndex = new Map((manualOrder ?? []).map((id, index) => [id, index]));
  const baseOrderedItems = manualOrder
    ? [...smartItems].sort((left, right) =>
        (orderIndex.get(left.tmdbId) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(right.tmdbId) ?? Number.MAX_SAFE_INTEGER)
        || smartPriority(right, episodeDetailsSettled) - smartPriority(left, episodeDetailsSettled))
    : smartItems;
  const deferred = new Set(deferredIds);
  const orderedItems = [
    ...baseOrderedItems.filter((item) => !deferred.has(item.tmdbId)),
    ...baseOrderedItems.filter((item) => deferred.has(item.tmdbId)),
  ];
  const featured = orderedItems[0] ?? null;
  const remainingItems = orderedItems.slice(1);
  const sections = categorizeItems(remainingItems, episodeDetailsSettled);

  const markWatched = async (item: EnrichedWatchNextItem) => {
    try {
      const result = await episodeToggle.mutateAsync({
        action: "add",
        showId: item.tmdbId,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeName: item.episode?.name || undefined,
      });
      showWatchUndo(`${episodeCode(item)} watched — your queue is updated`, result);
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
              {featured && (
                <FeaturedWatchCard
                  key={`featured-${featured.tmdbId}`}
                  item={featured}
                  pending={isPending(featured)}
                  disabled={episodeToggle.isPending}
                  onMark={() => void markWatched(featured)}
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
              />
              <WatchSection
                key="new"
                icon={<Sparkles className="h-4 w-4" />}
                title="New Episodes"
                subtitle="Fresh episodes released during the last 7 days"
                items={sections.newEpisodes}
                episodeTogglePending={episodeToggle.isPending}
                pendingId={episodeToggle.variables?.showId}
                onMark={markWatched}
                onOpen={goTv}
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
  onMark: () => void;
  onOpen: () => void;
  onNotNow: () => void;
}) {
  const detail = useTvDetail(item.tmdbId);
  const backdrop = tmdbImage(detail.data?.backdrop_path, "w1280") || item.poster;
  const progress = progressPercent(item);
  const episodeName = item.episode?.name || `Episode ${item.episodeNumber}`;
  const runtime = item.episode?.runtime || item.estimatedRuntime;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.22 }}
      className="tvtime-watch-featured"
      aria-labelledby={`watch-featured-${item.tmdbId}`}
    >
      <div className="tvtime-watch-featured__backdrop">
        <SafeImage src={backdrop} alt="" fill variant="backdrop" priority sizes="(max-width: 768px) 100vw, 1200px" />
      </div>
      <div className="tvtime-watch-featured__scrim" />
      <div className="tvtime-watch-featured__content">
        <div className="tvtime-watch-featured__eyebrow">
          <span>Up next</span>
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
          <span><CalendarDays className="h-3.5 w-3.5" />{releasedLabel(item.episode?.air_date)}</span>
          <span>{item.readyEpisodes === 1 ? "1 episode ready" : `${item.readyEpisodes} episodes ready`}</span>
        </div>
        <ProgressBar item={item} progress={progress} featured />
        <div className="tvtime-watch-featured__actions">
          <Button type="button" onClick={onMark} disabled={disabled} className="tvtime-watch-featured__primary">
            <CheckCircle2 className={pending ? "animate-pulse" : ""} />
            {pending ? "Updating…" : "Mark episode watched"}
          </Button>
          <Button type="button" variant="outline" onClick={onOpen} className="tvtime-watch-featured__secondary">
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

function WatchSection({
  icon,
  title,
  subtitle,
  items,
  episodeTogglePending,
  pendingId,
  onMark,
  onOpen,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: EnrichedWatchNextItem[];
  episodeTogglePending: boolean;
  pendingId?: number;
  onMark: (item: EnrichedWatchNextItem) => Promise<void>;
  onOpen: (id: number) => void;
  tone?: "default" | "new" | "behind" | "paused";
}) {
  if (items.length === 0) return null;
  return (
    <motion.section layout className="tvtime-watch-section" data-tone={tone}>
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
  tone,
}: {
  item: EnrichedWatchNextItem;
  disabled: boolean;
  pending: boolean;
  onMark: () => void;
  onOpen: () => void;
  tone: "default" | "new" | "behind" | "paused";
}) {
  const progress = progressPercent(item);
  const episodeName = item.episode?.name || `Episode ${item.episodeNumber}`;
  const runtime = item.episode?.runtime || item.estimatedRuntime;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="tvtime-watch-card"
      data-tone={tone}
      aria-busy={pending}
    >
      <button type="button" className="tvtime-watch-card__poster" onClick={onOpen} aria-label={`Open ${item.title}`}>
        <SafeImage src={item.poster} alt={item.title} fill variant="poster" sizes="(max-width: 479px) 80px, 112px" />
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
        <button type="button" className="tvtime-watch-card__title" onClick={onOpen}>{item.title}</button>
        <p className="tvtime-watch-card__episode"><strong>{episodeCode(item)}</strong><span>—</span>{episodeName}</p>
        <div className="tvtime-watch-card__meta">
          <span><Clock3 />{runtime}m</span>
          <span><CalendarDays />{releasedLabel(item.episode?.air_date)}</span>
          {tone === "paused" && <span><PauseCircle />{daysSince(item.lastActivity)}d paused</span>}
        </div>
        <ProgressBar item={item} progress={progress} />
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
            onClick={onOpen}
            aria-label={`View ${item.title} details`}
          >
            <Eye /> View
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function ProgressBar({ item, progress, featured = false }: { item: WatchNextItem; progress: number; featured?: boolean }) {
  return (
    <div className={featured ? "tvtime-watch-progress is-featured" : "tvtime-watch-progress"}>
      <div className="tvtime-watch-progress__copy">
        <span>{item.watchedEpisodes}/{item.releasedEpisodes} watched</span>
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
      <div className="h-12 shimmer rounded-xl" />
      <div className="tvtime-watch-skeleton__featured shimmer" />
      <div className="h-10 w-64 max-w-full shimmer rounded-lg" />
      <div className="tvtime-watch-card-grid">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-52 shimmer rounded-xl" />)}
      </div>
    </div>
  );
}

function categorizeItems(items: EnrichedWatchNextItem[], episodeDetailsSettled: boolean) {
  const result = {
    continueWatching: [] as EnrichedWatchNextItem[],
    newEpisodes: [] as EnrichedWatchNextItem[],
    fallingBehind: [] as EnrichedWatchNextItem[],
    paused: [] as EnrichedWatchNextItem[],
  };
  for (const item of items) {
    if (daysSince(item.lastActivity) >= PAUSED_DAYS) {
      result.paused.push(item);
    } else if (item.readyEpisodes >= 3 || item.watchedEpisodes === 0) {
      result.fallingBehind.push(item);
    } else if (episodeDetailsSettled && releasedWithin(item.episode?.air_date, RECENT_EPISODE_DAYS)) {
      result.newEpisodes.push(item);
    } else {
      result.continueWatching.push(item);
    }
  }
  return result;
}

function smartPriority(item: EnrichedWatchNextItem, episodeDetailsSettled: boolean) {
  const activityAge = daysSince(item.lastActivity);
  const releaseAge = item.episode?.air_date ? daysSince(`${item.episode.air_date}T00:00:00Z`) : Number.MAX_SAFE_INTEGER;
  const recentActivity = item.watchedEpisodes > 0 ? Math.max(0, 45 - activityAge) * 30 : 0;
  const oneReady = item.readyEpisodes === 1 ? 650 : 0;
  const newRelease = episodeDetailsSettled && releaseAge <= 14 ? Math.max(0, 14 - releaseAge) * 28 : 0;
  const nearCompletion = progressPercent(item) * 3;
  const backlogPenalty = Math.max(0, item.readyEpisodes - 2) * 45;
  const stalePenalty = Math.max(0, activityAge - PAUSED_DAYS) * 5;
  return recentActivity + oneReady + newRelease + nearCompletion - backlogPenalty - stalePenalty;
}

function progressPercent(item: Pick<WatchNextItem, "watchedEpisodes" | "releasedEpisodes">) {
  return Math.min(100, Math.max(0, Math.round((item.watchedEpisodes / Math.max(item.releasedEpisodes, 1)) * 100)));
}

function episodeCode(item: { seasonNumber: number; episodeNumber: number }) {
  return `S${String(item.seasonNumber).padStart(2, "0")} E${String(item.episodeNumber).padStart(2, "0")}`;
}

function formatReadyTime(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function releasedWithin(value: string | null | undefined, days: number) {
  if (!value) return false;
  const age = daysSince(`${value}T00:00:00Z`);
  return age >= 0 && age <= days;
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

function tmdbImage(path: string | null | undefined, size: string) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? `https://image.tmdb.org/t/p/${size}${path}` : null;
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
