import { detectIsAnime } from "@/lib/anime-detect";
import { detectIsArabic } from "@/lib/arabic-media";
import { isAsianMediaItem } from "@/lib/asian-media";

export type TvWorld = "standard" | "arabic" | "asian";

export type TvWorldClassificationInput = {
  title?: string | null;
  isAnime?: boolean | null;
  isArabic?: boolean | null;
  originalLanguage?: string | null;
  original_language?: string | null;
  originCountries?: string[] | null;
  origin_country?: string[] | null;
  genres?: string[] | null;
  classificationComplete?: boolean | null;
};

export function classifyTvWorld(show: TvWorldClassificationInput) {
  const originalLanguage = show.originalLanguage ?? show.original_language ?? null;
  const originCountries = show.originCountries ?? show.origin_country ?? [];
  const inferredArabic = detectIsArabic({
    originalLanguage,
    originCountry: originCountries,
  });
  const inferredAnime = !inferredArabic && detectIsAnime({
    title: show.title || undefined,
    originalLanguage,
    originCountry: originCountries,
    genres: show.genres,
  });

  // A complete TMDB classification supersedes stale persisted flags. When
  // authoritative metadata is unavailable, preserve explicit stored flags
  // and augment them with safe inference for legacy rows.
  const authoritative = show.classificationComplete === true;
  const isArabic = authoritative ? inferredArabic : Boolean(show.isArabic) || inferredArabic;
  const isAnime = !isArabic && (authoritative ? inferredAnime : Boolean(show.isAnime) || inferredAnime);
  const isAsian = !isArabic && !isAnime && isAsianMediaItem({
    originalLanguage,
    originCountries,
  });

  return {
    world: isArabic ? "arabic" : isAsian ? "asian" : "standard",
    isArabic,
    isAnime,
    isAsian,
  } as const;
}

export function recordMatchesTvWorld(show: TvWorldClassificationInput, world: TvWorld) {
  const classification = classifyTvWorld(show);
  if (classification.isAnime) return false;
  return classification.world === world;
}
