"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Award, BellRing, Clapperboard, Gem, History, Languages, Sparkles, Star, Timer, Trophy } from "lucide-react";
import {
  useDiscoverMovies,
  useDiscoverTv,
  useMediaStates,
  useMovieDetail,
  useOnTheAirTv,
  useRecentlyWatched,
  useTvDetail,
  useWatchlist,
} from "@/hooks/use-tmdb";
import { MediaRow as BaseMediaRow } from "@/components/media/media-row";
import type { MediaItem } from "@/lib/tmdb";
import {
  filterAndPrioritizeMediaCollectionWorldItems,
  filterAndPrioritizeMediaCollectionWorldItemsBy,
  mediaCollectionWorldForItem,
  type MediaWorldPipelineItem,
} from "@/lib/media-world-pipeline";
import type { MediaCollectionWorld } from "@/lib/media-world-classification";

const MediaRow = (props: ComponentProps<typeof BaseMediaRow>) => <BaseMediaRow {...props} compactCards={false} />;
const CURATED_ITEM_LIMIT = 12;

function detailCollectionWorld(detail: any, isTv: boolean): MediaCollectionWorld | null {
  if (!detail?.id) return null;
  const candidate: MediaWorldPipelineItem = {
    ...detail,
    type: isTv ? "series" : "movie",
    media_type: isTv ? "tv" : "movie",
    originalLanguage: detail.original_language || null,
    originCountries: isTv
      ? detail.origin_country ?? []
      : (detail.production_countries ?? []).map((country: any) => country?.iso_3166_1).filter(Boolean),
    genres: detail.genres ?? detail.genre_ids ?? [],
  };
  return mediaCollectionWorldForItem(candidate, isTv ? "tv" : "movie");
}

export function HomeCuratedSections() {
  return (
    <div>
      <DeferredCuratedGroup estimatedRows={4}>
        <CuratedLeadGroup />
      </DeferredCuratedGroup>
      <DeferredCuratedGroup estimatedRows={4}>
        <CuratedDiscoveryGroup />
      </DeferredCuratedGroup>
      <DeferredCuratedGroup estimatedRows={3}>
        <CuratedLibraryGroup />
      </DeferredCuratedGroup>
    </div>
  );
}

function DeferredCuratedGroup({ children, estimatedRows }: { children: ReactNode; estimatedRows: number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || enabled) return;
    if (!("IntersectionObserver" in window)) {
      setEnabled(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setEnabled(true);
      observer.disconnect();
    }, { rootMargin: "350px 0px" });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div
      ref={anchorRef}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `auto ${estimatedRows * 280}px`,
        minHeight: enabled ? undefined : `${estimatedRows * 280}px`,
      }}
      aria-hidden={enabled ? undefined : true}
    >
      {enabled ? children : <CuratedRowsPlaceholder rows={estimatedRows} />}
    </div>
  );
}

function CuratedRowsPlaceholder({ rows }: { rows: number }) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <div key={rowIndex} className="py-2" style={{ minHeight: "280px" }}>
      <div className="h-5 w-48 rounded-md shimmer" />
      <div className="mt-4 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((__, cardIndex) => (
          <div key={cardIndex} className="h-44 w-[116px] shrink-0 rounded-xl shimmer sm:w-[142px]" />
        ))}
      </div>
    </div>
  ));
}

function CuratedLeadGroup() {
  const recently = useRecentlyWatched(1);
  const latest = recently.data?.items?.[0];
  const latestId = Number(latest?.tmdbId || 0) || null;
  const latestIsTv = latest?.kind === "tv";
  const movieDetail = useMovieDetail(!latestIsTv ? latestId : null);
  const tvDetail = useTvDetail(latestIsTv ? latestId : null);
  const newEpisodes = useOnTheAirTv(1);
  const hiddenGems = useDiscoverMovies({ sort_by: "vote_average.desc", rating: 7, voteCount: 50 });
  const acclaimed = useDiscoverMovies({ sort_by: "vote_average.desc", rating: 8, voteCount: 1000 });

  const latestDetail = latestIsTv ? tvDetail.data : movieDetail.data;
  const becauseWorld = detailCollectionWorld(latestDetail, latestIsTv);
  const becauseCandidates = ((latestIsTv
    ? (tvDetail.data as any)?.recommendations?.results
    : (movieDetail.data as any)?.recommendations?.results) ?? [])
    .map((item: MediaItem) => ({ ...item, media_type: latestIsTv ? "tv" as const : "movie" as const }));
  const becauseItems = becauseWorld
    ? filterAndPrioritizeMediaCollectionWorldItems(validItems(becauseCandidates), becauseWorld).slice(0, CURATED_ITEM_LIMIT)
    : [];
  const becauseLoading = recently.isLoading
    || (latestId != null && (movieDetail.isLoading || tvDetail.isLoading));
  const episodeItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(newEpisodes.data?.results ?? []),
    "standard-tv",
  ).slice(0, CURATED_ITEM_LIMIT);
  const hiddenItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems((hiddenGems.data?.results ?? []).filter((item) => Number(item.vote_count || 0) < 2500)),
    "movies",
  ).slice(0, CURATED_ITEM_LIMIT);
  const acclaimedItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(acclaimed.data?.results ?? []),
    "movies",
  ).slice(0, CURATED_ITEM_LIMIT);

  const allItems = [becauseItems, episodeItems, hiddenItems, acclaimedItems].flat();
  const states = useMediaStates(allItems.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: item.media_type === "tv" ? "tv" as const : "movie" as const,
  })));
  const stateSource = useMemo(() => ({ data: states.data }), [states.data]);

  return (
    <>
      {(becauseLoading || becauseItems.length > 0) && <MediaRow title={`Because You Watched ${latest?.title || ""}`} icon={<Sparkles className="h-5 w-5" />} items={becauseItems} loading={becauseLoading} forcedMediaType={latestIsTv ? "tv" : "movie"} libraryStateSource={stateSource} />}
      <MediaRow title="New Episodes" icon={<BellRing className="h-5 w-5" />} items={episodeItems} loading={newEpisodes.isLoading} forcedMediaType="tv" libraryStateSource={stateSource} />
      <MediaRow title="Hidden Gems" icon={<Gem className="h-5 w-5" />} items={hiddenItems} loading={hiddenGems.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Critically Acclaimed" icon={<Star className="h-5 w-5" />} items={acclaimedItems} loading={acclaimed.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
    </>
  );
}

function CuratedDiscoveryGroup() {
  const awards = useDiscoverMovies({ sort_by: "vote_average.desc", rating: 7, keywordQuery: "Academy Award winner" });
  const shortMovies = useDiscoverMovies({ sort_by: "popularity.desc", rating: 6, voteCount: 100, runtimeLte: 90 });
  const miniSeries = useDiscoverTv({ sort_by: "vote_average.desc", rating: 7, voteCount: 100, keywordQuery: "miniseries" });
  const completed = useDiscoverTv({ sort_by: "vote_average.desc", rating: 7, voteCount: 500, keywordQuery: "ended series" });

  const awardItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(awards.data?.results ?? []),
    "movies",
  ).slice(0, CURATED_ITEM_LIMIT);
  const shortItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(shortMovies.data?.results ?? []),
    "movies",
  ).slice(0, CURATED_ITEM_LIMIT);
  const miniItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(miniSeries.data?.results ?? []),
    "standard-tv",
  ).slice(0, CURATED_ITEM_LIMIT);
  const completedItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(completed.data?.results ?? []),
    "standard-tv",
  ).slice(0, CURATED_ITEM_LIMIT);

  const allItems = [awardItems, shortItems, miniItems, completedItems].flat();
  const states = useMediaStates(allItems.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: item.media_type === "tv" ? "tv" as const : "movie" as const,
  })));
  const stateSource = useMemo(() => ({ data: states.data }), [states.data]);

  return (
    <>
      <MediaRow title="Award Winners" icon={<Award className="h-5 w-5" />} items={awardItems} loading={awards.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Short Movies" icon={<Timer className="h-5 w-5" />} items={shortItems} loading={shortMovies.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Mini-Series" icon={<Clapperboard className="h-5 w-5" />} items={miniItems} loading={miniSeries.isLoading} forcedMediaType="tv" libraryStateSource={stateSource} />
      <MediaRow title="Completed Shows" icon={<Trophy className="h-5 w-5" />} items={completedItems} loading={completed.isLoading} forcedMediaType="tv" libraryStateSource={stateSource} />
    </>
  );
}

function CuratedLibraryGroup() {
  const watchlist = useWatchlist();
  const arabicMovies = useDiscoverMovies({ sort_by: "popularity.desc", originalLanguage: "ar", language: "ar" });
  const arabicTv = useDiscoverTv({ sort_by: "popularity.desc", originalLanguage: "ar", language: "ar" });
  const arabicClassics = useDiscoverMovies({
    sort_by: "vote_average.desc",
    rating: 6,
    originalLanguage: "ar",
    language: "ar",
    releaseDateTo: `${new Date().getFullYear() - 20}-12-31`,
  });

  const arabicTrendingItems = filterAndPrioritizeMediaCollectionWorldItemsBy(validItems([
    ...(arabicMovies.data?.results ?? []).map((item) => ({ ...item, media_type: "movie" as const })),
    ...(arabicTv.data?.results ?? []).map((item) => ({ ...item, media_type: "tv" as const })),
  ]), (item) => item.media_type === "tv" ? "arabic-tv" : "arabic-movies").slice(0, CURATED_ITEM_LIMIT);
  const classicItems = filterAndPrioritizeMediaCollectionWorldItems(
    validItems(arabicClassics.data?.results ?? []),
    "arabic-movies",
  ).slice(0, CURATED_ITEM_LIMIT);
  const forgottenItems = useMemo(() => (watchlist.data?.items ?? [])
    .slice()
    .sort((left: any, right: any) => new Date(left.addedAt || 0).getTime() - new Date(right.addedAt || 0).getTime())
    .slice(0, CURATED_ITEM_LIMIT)
    .map(toMediaItem)
    .filter((item: MediaItem) => item.id && item.poster_path), [watchlist.data?.items]);

  const allItems = [forgottenItems, arabicTrendingItems, classicItems].flat();
  const states = useMediaStates(allItems.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: item.media_type === "tv" ? "tv" as const : "movie" as const,
  })));
  const stateSource = useMemo(() => ({ data: states.data }), [states.data]);

  return (
    <>
      <MediaRow title="Forgotten Watchlist" icon={<History className="h-5 w-5" />} items={forgottenItems} loading={watchlist.isLoading} libraryStateSource={stateSource} />
      <MediaRow title="Arabic Trending" icon={<Languages className="h-5 w-5" />} items={arabicTrendingItems} loading={arabicMovies.isLoading || arabicTv.isLoading} libraryStateSource={stateSource} />
      <MediaRow title="Arabic Classics" icon={<Languages className="h-5 w-5" />} items={classicItems} loading={arabicClassics.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
    </>
  );
}

function validItems<T extends MediaItem>(items: readonly T[]): T[] {
  return items.filter((item) => Boolean(item.id && item.poster_path));
}

function toMediaItem(item: any): MediaItem {
  const isTv = item.mediaType === "tv" || item.type === "series";
  return {
    id: Number(item.tmdbId || item.id),
    media_type: isTv ? "tv" : "movie",
    title: isTv ? undefined : item.title,
    name: isTv ? item.title : undefined,
    poster_path: item.posterPath || item.poster || null,
    backdrop_path: item.backdropPath || null,
    release_date: isTv ? undefined : item.releaseDate,
    first_air_date: isTv ? item.releaseDate : undefined,
    vote_average: Number(item.voteAverage || item.rating || 0),
    vote_count: 0,
    popularity: 0,
    overview: item.overview || "",
    genre_ids: [],
    original_language: item.originalLanguage || "",
    origin_country: item.originCountries || [],
  } as MediaItem;
}
