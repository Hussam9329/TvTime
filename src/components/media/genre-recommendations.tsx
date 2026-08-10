"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDiscoverMovies, useDiscoverTv, useMovieGenres, useTvGenres, useMedia, useMediaStates } from "@/hooks/use-tmdb";
import { MediaRow } from "@/components/media/media-row";
import { Sparkles, Star } from "lucide-react";
import { filterAndPrioritizeMediaCollectionWorldItems } from "@/lib/media-world-pipeline";

const GENRE_ITEM_LIMIT = 12;
const RATED_SAMPLE_LIMIT = 120;
const OFFSCREEN_RECOMMENDATION_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 280px",
};

/**
 * TVM-42: Personalized recommendations.
 *
 * Instead of random daily genres, derives the user's top genres from their
 * highest-rated movies and TV shows. Falls back to popular genres if the user
 * has no ratings yet.
 *
 * The user's genres come from the stored `genres` array on Media rows that
 * have a high userRating (>= 70). We count genre frequency across those rows
 * and pick the top 2 movie genres + top 1 TV genre.
 */
export function GenreRecommendations() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || enabled) return;
    if (!("IntersectionObserver" in window)) {
      setEnabled(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setEnabled(true);
        observer.disconnect();
      },
      { rootMargin: "350px 0px" },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div
      ref={anchorRef}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "auto 840px",
        minHeight: enabled ? undefined : "840px",
      }}
    >
      {enabled ? <GenreRecommendationContent /> : <RecommendationRowsPlaceholder rows={3} />}
    </div>
  );
}

function GenreRecommendationContent() {
  const movieGenres = useMovieGenres();
  const tvGenres = useTvGenres();

  // A bounded sample is enough to identify recurring high-rated genres while
  // avoiding two 500-row payloads on mobile.
  const ratedMovies = useMedia({ collectionWorld: "movies", type: "movie", rated: "true", limit: RATED_SAMPLE_LIMIT });
  const ratedTv = useMedia({ collectionWorld: "standard-tv", type: "series", rated: "true", limit: RATED_SAMPLE_LIMIT });

  const userMovieGenres = deriveTopGenres(ratedMovies.data?.items ?? [], movieGenres.data ?? [], 2);
  const userTvGenres = deriveTopGenres(ratedTv.data?.items ?? [], tvGenres.data ?? [], 1);

  // Fallback to daily rotation if user has no ratings.
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const movieGenreList = movieGenres.data ?? [];
  const tvGenreList = tvGenres.data ?? [];

  const fallbackMovieGenre1 = movieGenreList[dayOfYear % Math.max(movieGenreList.length, 1)];
  const fallbackMovieGenre2 = movieGenreList[(dayOfYear + 3) % Math.max(movieGenreList.length, 1)];
  const fallbackTvGenre = tvGenreList[(dayOfYear + 1) % Math.max(tvGenreList.length, 1)];

  const movieGenre1 = userMovieGenres[0] || fallbackMovieGenre1;
  const movieGenre2 = userMovieGenres[1] || fallbackMovieGenre2;
  const tvGenre1 = userTvGenres[0] || fallbackTvGenre;
  const isPersonalized = userMovieGenres.length > 0 || userTvGenres.length > 0;

  return (
    <>
      <DeferredRecommendationRow ready={Boolean(movieGenre1)}>
        {movieGenre1 && (
          <MovieGenreRow
            genre={movieGenre1}
            sortBy="vote_average.desc"
            rating={7}
            title={isPersonalized ? `Top ${movieGenre1.name} Movies • For You` : `Top ${movieGenre1.name} Movies`}
            personalized={isPersonalized}
          />
        )}
      </DeferredRecommendationRow>
      <DeferredRecommendationRow ready={Boolean(tvGenre1)}>
        {tvGenre1 && (
          <TvGenreRow
            genre={tvGenre1}
            title={isPersonalized ? `Popular ${tvGenre1.name} Shows • For You` : `Popular ${tvGenre1.name} Shows`}
            personalized={isPersonalized}
          />
        )}
      </DeferredRecommendationRow>
      <DeferredRecommendationRow ready={Boolean(movieGenre2)}>
        {movieGenre2 && (
          <MovieGenreRow
            genre={movieGenre2}
            sortBy="popularity.desc"
            title={isPersonalized ? `Trending ${movieGenre2.name} Movies • For You` : `Trending ${movieGenre2.name} Movies`}
            personalized={isPersonalized}
          />
        )}
      </DeferredRecommendationRow>
    </>
  );
}

function DeferredRecommendationRow({ children, ready }: { children: ReactNode; ready: boolean }) {
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
    }, { rootMargin: "250px 0px" });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div
      ref={anchorRef}
      style={{
        ...OFFSCREEN_RECOMMENDATION_STYLE,
        minHeight: enabled && ready ? undefined : "280px",
      }}
      aria-hidden={enabled && ready ? undefined : true}
    >
      {enabled && ready ? children : <RecommendationPlaceholder />}
    </div>
  );
}

function MovieGenreRow({ genre, sortBy, rating, title, personalized }: {
  genre: { id: number; name: string };
  sortBy: string;
  rating?: number;
  title: string;
  personalized: boolean;
}) {
  const recommendation = useDiscoverMovies({
    genres: [genre.id],
    sort_by: sortBy,
    page: 1,
    rating,
  });
  const items = filterAndPrioritizeMediaCollectionWorldItems(
    (recommendation.data?.results ?? []).filter((media) => media.poster_path),
    "movies",
  ).slice(0, GENRE_ITEM_LIMIT);
  const states = useMediaStates(items.map((item) => ({ tmdbId: Number(item.id), mediaType: "movie" as const })));
  const libraryStateSource = useMemo(() => ({ data: states.data }), [states.data]);

  if (!recommendation.isLoading && items.length === 0) return null;
  return (
    <MediaRow
      title={title}
      icon={<RecommendationIcon personalized={personalized} />}
      items={items}
      loading={recommendation.isLoading}
      libraryStateSource={libraryStateSource}
      compactCards={false}
    />
  );
}

function TvGenreRow({ genre, title, personalized }: {
  genre: { id: number; name: string };
  title: string;
  personalized: boolean;
}) {
  const recommendation = useDiscoverTv({
    genres: [genre.id],
    sort_by: "popularity.desc",
    page: 1,
  });
  const items = filterAndPrioritizeMediaCollectionWorldItems(
    (recommendation.data?.results ?? []).filter((media) => media.poster_path),
    "standard-tv",
  ).slice(0, GENRE_ITEM_LIMIT);
  const states = useMediaStates(items.map((item) => ({ tmdbId: Number(item.id), mediaType: "tv" as const })));
  const libraryStateSource = useMemo(() => ({ data: states.data }), [states.data]);

  if (!recommendation.isLoading && items.length === 0) return null;
  return (
    <MediaRow
      title={title}
      icon={<RecommendationIcon personalized={personalized} />}
      items={items}
      loading={recommendation.isLoading}
      forcedMediaType="tv"
      libraryStateSource={libraryStateSource}
      compactCards={false}
    />
  );
}

function RecommendationIcon({ personalized }: { personalized: boolean }) {
  return personalized
    ? <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
    : <Sparkles className="h-5 w-5" />;
}

function RecommendationPlaceholder() {
  return (
    <div className="py-2" aria-hidden="true">
      <div className="h-5 w-48 rounded-md shimmer" />
      <div className="mt-4 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-44 w-[116px] shrink-0 rounded-xl shimmer sm:w-[142px]" />
        ))}
      </div>
    </div>
  );
}

function RecommendationRowsPlaceholder({ rows }: { rows: number }) {
  return Array.from({ length: rows }).map((_, index) => (
    <div key={index} style={{ minHeight: "280px" }}>
      <RecommendationPlaceholder />
    </div>
  ));
}

/**
 * TVM-42: Derive the user's top N genres from their highest-rated media.
 * Counts genre frequency across items with userRating >= 70, then returns
 * the top N Genre objects matched against the official TMDB genre list.
 */
function deriveTopGenres(
  items: any[],
  officialGenres: { id: number; name: string }[],
  count: number,
): { id: number; name: string }[] {
  const genreCounts = new Map<number, number>();

  for (const item of items) {
    if (item.userRating == null || item.userRating < 70) continue;

    const genres: string[] = Array.isArray(item.genres) ? item.genres : [];
    for (const genreName of genres) {
      const official = officialGenres.find((genre) => genre.name.toLowerCase() === String(genreName).toLowerCase());
      if (official) genreCounts.set(official.id, (genreCounts.get(official.id) || 0) + 1);
    }
  }

  return [...genreCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([id]) => {
      const genre = officialGenres.find((candidate) => candidate.id === id);
      return genre ? { id: genre.id, name: genre.name } : { id, name: String(id) };
    });
}
