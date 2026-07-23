"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { MediaRow } from "@/components/media/media-row";
import type { MediaItem } from "@/lib/tmdb";

export function HomeCuratedSections() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || enabled) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setEnabled(true);
      observer.disconnect();
    }, { rootMargin: "900px 0px" });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [enabled]);

  return <div ref={anchorRef} className="min-h-24">{enabled ? <CuratedContent /> : null}</div>;
}

function CuratedContent() {
  const recently = useRecentlyWatched(1);
  const latest = recently.data?.items?.[0];
  const latestId = Number(latest?.tmdbId || 0) || null;
  const latestIsTv = latest?.kind === "tv";
  const movieDetail = useMovieDetail(!latestIsTv ? latestId : null);
  const tvDetail = useTvDetail(latestIsTv ? latestId : null);
  const watchlist = useWatchlist();

  const newEpisodes = useOnTheAirTv(1);
  const hiddenGems = useDiscoverMovies({ sort_by: "vote_average.desc", rating: 7, voteCount: 50 });
  const acclaimed = useDiscoverMovies({ sort_by: "vote_average.desc", rating: 8, voteCount: 1000 });
  const awards = useDiscoverMovies({ sort_by: "vote_average.desc", rating: 7, keywordQuery: "Academy Award winner" });
  const shortMovies = useDiscoverMovies({ sort_by: "popularity.desc", rating: 6, voteCount: 100, runtimeLte: 90 });
  const miniSeries = useDiscoverTv({ sort_by: "vote_average.desc", rating: 7, voteCount: 100, keywordQuery: "miniseries" });
  const completed = useDiscoverTv({ sort_by: "vote_average.desc", rating: 7, voteCount: 500, keywordQuery: "ended series" });
  const arabicMovies = useDiscoverMovies({ sort_by: "popularity.desc", originalLanguage: "ar", language: "ar" });
  const arabicTv = useDiscoverTv({ sort_by: "popularity.desc", originalLanguage: "ar", language: "ar" });
  const arabicClassics = useDiscoverMovies({
    sort_by: "vote_average.desc",
    rating: 6,
    originalLanguage: "ar",
    language: "ar",
    releaseDateTo: `${new Date().getFullYear() - 20}-12-31`,
  });

  const valid = (items: MediaItem[]) => items.filter((item) => item.id && item.poster_path).slice(0, 20);
  const becauseItems = valid((latestIsTv ? tvDetail.data?.recommendations?.results : movieDetail.data?.recommendations?.results) ?? []);
  const episodeItems = valid(newEpisodes.data?.results ?? []);
  const hiddenItems = valid((hiddenGems.data?.results ?? []).filter((item) => Number(item.vote_count || 0) < 2500));
  const acclaimedItems = valid(acclaimed.data?.results ?? []);
  const awardItems = valid(awards.data?.results ?? []);
  const shortItems = valid(shortMovies.data?.results ?? []);
  const miniItems = valid(miniSeries.data?.results ?? []);
  const completedItems = valid(completed.data?.results ?? []);
  const arabicTrendingItems = valid([
    ...(arabicMovies.data?.results ?? []).map((item) => ({ ...item, media_type: "movie" as const })),
    ...(arabicTv.data?.results ?? []).map((item) => ({ ...item, media_type: "tv" as const })),
  ]);
  const classicItems = valid(arabicClassics.data?.results ?? []);
  const forgottenItems = useMemo(() => (watchlist.data?.items ?? [])
    .slice()
    .sort((left: any, right: any) => new Date(left.addedAt || 0).getTime() - new Date(right.addedAt || 0).getTime())
    .slice(0, 20)
    .map(toMediaItem)
    .filter((item: MediaItem) => item.id && item.poster_path), [watchlist.data?.items]);

  const allItems = [becauseItems, episodeItems, hiddenItems, acclaimedItems, awardItems, shortItems, miniItems, completedItems, forgottenItems, arabicTrendingItems, classicItems].flat();
  const states = useMediaStates(allItems.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: item.media_type === "tv" ? "tv" as const : "movie" as const,
  })));
  const stateSource = { data: states.data };

  return (
    <>
      {becauseItems.length > 0 && <MediaRow title={`Because You Watched ${latest?.title || ""}`} icon={<Sparkles className="h-5 w-5" />} items={becauseItems} loading={movieDetail.isLoading || tvDetail.isLoading} forcedMediaType={latestIsTv ? "tv" : "movie"} libraryStateSource={stateSource} />}
      <MediaRow title="New Episodes" icon={<BellRing className="h-5 w-5" />} items={episodeItems} loading={newEpisodes.isLoading} forcedMediaType="tv" libraryStateSource={stateSource} />
      <MediaRow title="Hidden Gems" icon={<Gem className="h-5 w-5" />} items={hiddenItems} loading={hiddenGems.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Critically Acclaimed" icon={<Star className="h-5 w-5" />} items={acclaimedItems} loading={acclaimed.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Award Winners" icon={<Award className="h-5 w-5" />} items={awardItems} loading={awards.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Short Movies" icon={<Timer className="h-5 w-5" />} items={shortItems} loading={shortMovies.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
      <MediaRow title="Mini-Series" icon={<Clapperboard className="h-5 w-5" />} items={miniItems} loading={miniSeries.isLoading} forcedMediaType="tv" libraryStateSource={stateSource} />
      <MediaRow title="Completed Shows" icon={<Trophy className="h-5 w-5" />} items={completedItems} loading={completed.isLoading} forcedMediaType="tv" libraryStateSource={stateSource} />
      <MediaRow title="Forgotten Watchlist" icon={<History className="h-5 w-5" />} items={forgottenItems} loading={watchlist.isLoading} libraryStateSource={stateSource} />
      <MediaRow title="Arabic Trending" icon={<Languages className="h-5 w-5" />} items={arabicTrendingItems} loading={arabicMovies.isLoading || arabicTv.isLoading} libraryStateSource={stateSource} />
      <MediaRow title="Arabic Classics" icon={<Languages className="h-5 w-5" />} items={classicItems} loading={arabicClassics.isLoading} forcedMediaType="movie" libraryStateSource={stateSource} />
    </>
  );
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
    overview: item.overview || "",
    genre_ids: [],
    original_language: item.originalLanguage || "",
    origin_country: item.originCountries || [],
  } as MediaItem;
}
