import { classifyTvWorld, type TvWorldClassificationInput } from "@/lib/tv-world-classification";

export type MediaCollectionWorld =
  | "movies"
  | "anime"
  | "arabic-movies"
  | "standard-tv"
  | "arabic-tv"
  | "asian-tv";

export type GeneralMediaClassificationInput = TvWorldClassificationInput & {
  type?: string | null;
};

export type MediaClassificationFilters = {
  isAnime?: boolean;
  isArabic?: boolean;
  isAsian?: boolean;
};

export function classifyMediaWorld(media: GeneralMediaClassificationInput) {
  const classification = classifyTvWorld(media);
  const isSeries = media.type === "series" || media.type === "tv";
  const isAsian = isSeries && classification.isAsian;
  const collectionWorld: MediaCollectionWorld = classification.isArabic
    ? isSeries
      ? "arabic-tv"
      : "arabic-movies"
    : classification.isAnime
      ? "anime"
      : isSeries
        ? isAsian
          ? "asian-tv"
          : "standard-tv"
        : "movies";

  return {
    ...classification,
    isAsian,
    isSeries,
    collectionWorld,
  } as const;
}

export function recordMatchesMediaClassification(
  media: GeneralMediaClassificationInput,
  filters: MediaClassificationFilters,
) {
  const classification = classifyMediaWorld(media);
  if (filters.isAnime !== undefined && classification.isAnime !== filters.isAnime) return false;
  if (filters.isArabic !== undefined && classification.isArabic !== filters.isArabic) return false;
  if (filters.isAsian !== undefined && classification.isAsian !== filters.isAsian) return false;
  return true;
}
