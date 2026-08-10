"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
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
import {
  mediaStateKey,
  useMediaStates,
  useTvHubCatalogue,
  useTvTracking,
  type TvHubWorld,
} from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { getTitle, img, type MediaItem } from "@/lib/tmdb";
import {
  collectionWorldForCatalogue,
  filterAndPrioritizeMediaCollectionWorldItems,
  type MediaWorldPipelineItem,
} from "@/lib/media-world-pipeline";

type TvHubCopy = {
  featured: string;
  viewDetails: string;
  continueWatching: string;
  airingToday: string;
  upToDate: string;
  newNoteworthy: string;
  returningSoon: string;
  hiddenGems: string;
  recentlyWatched: string;
  emptyContinue: string;
  partial: string;
};

function copyFor(world: TvHubWorld): TvHubCopy {
  if (world === "arabic") {
    return {
      featured: "مختار لك",
      viewDetails: "عرض التفاصيل",
      continueWatching: "أكمل المشاهدة",
      airingToday: "يعرض اليوم",
      upToDate: "محدّث حتى آخر حلقة",
      newNoteworthy: "جديد وجدير بالمشاهدة",
      returningSoon: "يعود قريباً",
      hiddenGems: "مسلسلات تستحق الاكتشاف",
      recentlyWatched: "شاهدته مؤخراً",
      emptyContinue: "لا توجد حلقات صادرة بانتظارك الآن.",
      partial: "بعض اقتراحات الكتالوج غير متاحة مؤقتاً، لكن بيانات مكتبتك كاملة.",
    };
  }
  return {
    featured: world === "asian" ? "Asian spotlight" : "Series spotlight",
    viewDetails: "View details",
    continueWatching: "Continue Watching",
    airingToday: "Airing Today",
    upToDate: "Up to Date",
    newNoteworthy: "New & Noteworthy",
    returningSoon: "Returning Soon",
    hiddenGems: "Hidden Gems",
    recentlyWatched: "Recently Watched",
    emptyContinue: "No released episodes are waiting for you right now.",
    partial: "Some catalogue picks are temporarily unavailable; your personal shelves are still complete.",
  };
}

function mediaTitle(item: MediaItem) {
  return getTitle(item);
}

function mediaYear(item: MediaItem) {
  return (item.first_air_date || item.release_date || "").slice(0, 4);
}

type TvHubMediaItem = MediaItem & MediaWorldPipelineItem;

function trackedToMedia(show: any): TvHubMediaItem | null {
  const id = Number(show?.tmdbId);
  if (!Number.isFinite(id) || id <= 0 || !show?.poster) return null;
  return {
    id,
    name: show.title,
    original_name: show.originalTitle || undefined,
    poster_path: show.poster,
    backdrop_path: null,
    overview: show.overview || "",
    first_air_date: show.year ? `${String(show.year).slice(0, 4)}-01-01` : undefined,
    vote_average: Number(show.rating || 0),
    vote_count: 0,
    popularity: 0,
    media_type: "tv",
    original_language: show.originalLanguage || undefined,
    origin_country: Array.isArray(show.originCountries) ? show.originCountries : [],
    type: "series",
    originalLanguage: show.originalLanguage || null,
    originCountries: Array.isArray(show.originCountries) ? show.originCountries : [],
    genres: Array.isArray(show.genres) ? show.genres : [],
    isArabic: show.isArabic,
    isAnime: show.isAnime,
    classificationComplete: show.classificationComplete,
  };
}

function dedupe(items: readonly TvHubMediaItem[], limit = 20, world: TvHubWorld = "standard") {
  const seen = new Set<number>();
  const result: TvHubMediaItem[] = [];
  const candidates = filterAndPrioritizeMediaCollectionWorldItems(
    items,
    collectionWorldForCatalogue(world, "tv"),
  );
  for (const item of candidates) {
    if (!item.id || seen.has(item.id) || !item.poster_path) continue;
    seen.add(item.id);
    result.push({ ...item, media_type: "tv" });
    if (result.length >= limit) break;
  }
  return result;
}

export function TvHubOverview({ world, onBrowse }: { world: TvHubWorld; onBrowse: () => void }) {
  const copy = copyFor(world);
  const isArabic = world === "arabic";

  const tracking = useTvTracking({ world, category: "all", sortBy: "updatedAt", order: "desc", limit: 60, offset: 0 });
  const catalogue = useTvHubCatalogue(world);

  const trackedItems = tracking.data?.items ?? [];
  const trackedById = useMemo(() => new Map<number, any>(trackedItems
    .map((show: any) => [Number(show.tmdbId), show] as const)
    .filter(([id]) => Number.isFinite(id) && id > 0)), [trackedItems]);

  const popularItems = dedupe(catalogue.data?.popular ?? [], 18, world);
  const newItems = dedupe(catalogue.data?.newNoteworthy ?? [], 16, world);
  const hiddenItems = dedupe(catalogue.data?.hiddenGems ?? [], 16, world);
  const airingItems = dedupe(catalogue.data?.airingToday ?? [], 16, world);

  const continueItems = dedupe(trackedItems
    .filter((show: any) => show._trackingStatus !== "stopped" && show._trackingStatus !== "finished" && show._hasUnwatchedReleasedEpisode)
    .map(trackedToMedia)
    .filter((item: TvHubMediaItem | null): item is TvHubMediaItem => Boolean(item)), 18, world);
  const upToDateItems = dedupe(trackedItems
    .filter((show: any) => show._trackingStatus === "uptodate")
    .map(trackedToMedia)
    .filter((item: TvHubMediaItem | null): item is TvHubMediaItem => Boolean(item)), 18, world);
  const returningItems = dedupe([...trackedItems]
    .filter((show: any) => show._trackingStatus !== "stopped" && show._nextEpisodeAirDate && Date.parse(show._nextEpisodeAirDate) > Date.now())
    .sort((left: any, right: any) => Date.parse(left._nextEpisodeAirDate) - Date.parse(right._nextEpisodeAirDate))
    .map(trackedToMedia)
    .filter((item: TvHubMediaItem | null): item is TvHubMediaItem => Boolean(item)), 18, world);
  const recentItems = dedupe([...trackedItems]
    .filter((show: any) => show._lastWatchedAt)
    .sort((left: any, right: any) => Date.parse(right._lastWatchedAt) - Date.parse(left._lastWatchedAt))
    .map(trackedToMedia)
    .filter((item: TvHubMediaItem | null): item is TvHubMediaItem => Boolean(item)), 18, world);

  const allItems = useMemo(() => dedupe([
    ...popularItems,
    ...continueItems,
    ...airingItems,
    ...upToDateItems,
    ...newItems,
    ...returningItems,
    ...hiddenItems,
    ...recentItems,
  ], 120, world), [popularItems, continueItems, airingItems, upToDateItems, newItems, returningItems, hiddenItems, recentItems, world]);
  const states = useMediaStates(allItems.map((item) => ({ tmdbId: item.id, mediaType: "tv" as const })), {
    enabled: allItems.length > 0,
  });
  const sharedStates = { data: states.data };
  const featured = popularItems
    .filter((item) => {
      if (!item.backdrop_path) return false;
      const tracked = trackedById.get(item.id);
      const state = states.data?.[mediaStateKey("tv", item.id)];
      return tracked?._trackingStatus !== "finished"
        && tracked?._trackingStatus !== "stopped"
        && state?.status !== "finished";
    })
    .slice(0, 4);

  const publicLoading = catalogue.isLoading;
  const allFailed = tracking.isError && catalogue.isError;
  if (allFailed) {
    return (
      <Card className="tvtime-movie-hub__error" role="alert">
        <Zap aria-hidden="true" />
        <h2>{isArabic ? "تعذر تحميل واجهة المسلسلات" : "Could not load this TV world"}</h2>
        <p>{isArabic ? "مكتبتك آمنة. حاول مرة أخرى بعد قليل." : "Your library is safe. Please try again in a moment."}</p>
        <Button variant="outline" onClick={() => { void tracking.refetch(); void catalogue.refetch(); }}>
          {isArabic ? "إعادة المحاولة" : "Retry"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="tvtime-movie-hub__overview tvtime-tv-hub__overview">
      {featured.length > 0 ? (
        <TvHubHero items={featured} trackingById={trackedById} copy={copy} isArabic={isArabic} />
      ) : publicLoading ? (
        <div className="h-[clamp(22rem,48vw,34rem)] rounded-[1.5rem] shimmer" aria-hidden="true" />
      ) : null}

      {continueItems.length > 0 ? (
        <MediaRow title={copy.continueWatching} icon={<CirclePlay />} items={continueItems} forcedMediaType="tv" libraryStateSource={sharedStates} />
      ) : !tracking.isLoading ? (
        <section className="tvtime-movie-hub__empty-row">
          <span aria-hidden="true"><Trophy /></span>
          <div className="min-w-0 flex-1"><h2>{copy.continueWatching}</h2><p>{copy.emptyContinue}</p></div>
          <Button size="sm" variant="outline" onClick={onBrowse}>{isArabic ? "اكتشف" : "Discover"}</Button>
        </section>
      ) : null}

      {airingItems.length > 0 && <MediaRow title={copy.airingToday} icon={<CalendarDays />} items={airingItems} forcedMediaType="tv" libraryStateSource={sharedStates} />}
      {upToDateItems.length > 0 && <MediaRow title={copy.upToDate} icon={<Zap />} items={upToDateItems} forcedMediaType="tv" libraryStateSource={sharedStates} />}
      {newItems.length > 0 && <MediaRow title={copy.newNoteworthy} icon={<WandSparkles />} items={newItems} forcedMediaType="tv" libraryStateSource={sharedStates} />}
      {returningItems.length > 0 && <MediaRow title={copy.returningSoon} icon={<Clock3 />} items={returningItems} forcedMediaType="tv" libraryStateSource={sharedStates} />}
      {hiddenItems.length > 0 && <MediaRow title={copy.hiddenGems} icon={<Star />} items={hiddenItems} forcedMediaType="tv" libraryStateSource={sharedStates} />}
      {recentItems.length > 0 && <MediaRow title={copy.recentlyWatched} icon={<Clock3 />} items={recentItems} forcedMediaType="tv" libraryStateSource={sharedStates} />}

      {(catalogue.isError || catalogue.data?.partial) && (
        <p className="tvtime-movie-hub__partial" role="status">{copy.partial}</p>
      )}
    </div>
  );
}

function TvHubHero({
  items,
  trackingById,
  copy,
  isArabic,
}: {
  items: MediaItem[];
  trackingById: Map<number, any>;
  copy: TvHubCopy;
  isArabic: boolean;
}) {
  const goTv = useNav((state) => state.goTv);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const item = items[active % items.length];
  const tracked = trackingById.get(item.id);
  const watched = Number(tracked?._watchedAiredEpisodeCount ?? tracked?._watchedEpisodeCount ?? 0);
  const aired = Number(tracked?._airedEpisodeCount ?? 0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setTimeout(() => setActive((value) => (value + 1) % items.length), 8000);
    return () => window.clearTimeout(timer);
  }, [active, items.length]);

  const move = (direction: -1 | 1) => setActive((value) => (value + direction + items.length) % items.length);

  return (
    <motion.section
      className="tvtime-movie-hub-hero tvtime-tv-hub-hero"
      aria-roledescription="carousel"
      aria-label={`${copy.featured}: ${mediaTitle(item)}`}
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
          key={`tv-hub-backdrop-${item.id}`}
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
          key={`tv-hub-copy-${item.id}`}
          className="tvtime-movie-hub-hero__content"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
        >
          <div className="tvtime-movie-hub-hero__meta">
            <span><Sparkles /> {copy.featured}</span>
            {mediaYear(item) && <span>{mediaYear(item)}</span>}
            {item.vote_average > 0 && <span><Star className="fill-current" /> {item.vote_average.toFixed(1)}</span>}
            {aired > 0 && <span><CirclePlay /> {watched}/{aired}</span>}
          </div>
          <h2>{mediaTitle(item)}</h2>
          <p className="line-clamp-2">{tracked?._nextEpisodeAirDate
            ? `${isArabic ? "الحلقة القادمة" : "Next episode"}: ${tracked._nextEpisodeSeasonNumber ? `S${tracked._nextEpisodeSeasonNumber}` : ""}${tracked._nextEpisodeNumber ? `E${tracked._nextEpisodeNumber}` : ""}${tracked._nextEpisodeName ? ` · ${tracked._nextEpisodeName}` : ""}`
            : item.overview}</p>
          <div className="tvtime-movie-hub-hero__actions">
            <Button size="lg" onClick={() => goTv(item.id)}><Play className="fill-current" /> {copy.viewDetails}</Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <div className="tvtime-home-hero__carousel-controls relative z-20" aria-label={isArabic ? "شرائح المسلسلات المميزة" : "Featured TV slides"}>
          <button type="button" className="tvtime-home-hero__carousel-arrow" onClick={() => move(-1)} aria-label={isArabic ? "السابق" : "Previous featured series"}><ChevronLeft /></button>
          <div className="tvtime-home-hero__carousel-dots">
            {items.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                className="tvtime-home-hero__carousel-dot"
                data-active={index === active ? "true" : "false"}
                onClick={() => setActive(index)}
                aria-label={`${isArabic ? "عرض" : "Show"} ${mediaTitle(candidate)}`}
                aria-current={index === active ? "true" : undefined}
              />
            ))}
          </div>
          <button type="button" className="tvtime-home-hero__carousel-arrow" onClick={() => move(1)} aria-label={isArabic ? "التالي" : "Next featured series"}><ChevronRight /></button>
        </div>
      )}
    </motion.section>
  );
}
