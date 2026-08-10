import { detectIsAnime } from "@/lib/anime-detect";
import {
  arabicMediaOriginCountries,
  arabicMediaOriginalLanguage,
  detectIsArabic,
} from "@/lib/arabic-media";
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
  genres?: Array<string | number | { id?: number; name: string }> | null;
  classificationComplete?: boolean | null;
};

export function classifyTvWorld(show: TvWorldClassificationInput) {
  const originalLanguage = arabicMediaOriginalLanguage(show);
  const originCountries = arabicMediaOriginCountries(show);
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

  // Original-language metadata is enough to supersede a stale Arabic flag.
  // Anime needs either the explicit completeness marker or a usable language
  // + genre pair. Sparse legacy rows may still use their persisted flags.
  const authoritative = show.classificationComplete === true
    || Boolean(originalLanguage && Array.isArray(show.genres) && show.genres.length > 0);
  const arabicAuthoritative = authoritative || originalLanguage !== null;
  const isArabic = arabicAuthoritative ? inferredArabic : Boolean(show.isArabic) || inferredArabic;
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
