import { arabicMediaCountryPriority } from "@/lib/arabic-media";
import { asianMediaCountryPriority } from "@/lib/asian-media";
import {
  classifyMediaWorld,
  type GeneralMediaClassificationInput,
  type MediaCollectionWorld,
} from "@/lib/media-world-classification";
import { standardMediaCountryPriority } from "@/lib/standard-media-priority";

export type CatalogueWorld = "standard" | "arabic" | "asian" | "anime";

export type MediaWorldPipelineItem = GeneralMediaClassificationInput & {
  name?: string | null;
  originalTitle?: string | null;
  originalName?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  originCountry?: string[] | null;
  genreIds?: number[] | null;
  genre_ids?: number[] | null;
  media_type?: string | null;
};

export function collectionWorldForCatalogue(
  world: CatalogueWorld,
  mediaType: "movie" | "tv",
): MediaCollectionWorld {
  if (world === "anime") return "anime";
  if (world === "arabic") return mediaType === "tv" ? "arabic-tv" : "arabic-movies";
  if (world === "asian") return mediaType === "tv" ? "asian-tv" : "asian-movies";
  return mediaType === "tv" ? "standard-tv" : "movies";
}

function normalizedClassificationInput(
  item: MediaWorldPipelineItem,
  world: MediaCollectionWorld,
): GeneralMediaClassificationInput {
  const isSeries = world === "standard-tv" || world === "arabic-tv" || world === "asian-tv"
    || item.type === "series" || item.type === "tv" || item.media_type === "tv";
  return {
    ...item,
    type: isSeries ? "series" : "movie",
    title: item.title || item.name || item.originalTitle || item.originalName
      || item.original_title || item.original_name || null,
    originalLanguage: item.originalLanguage || item.original_language || null,
    originCountries: [
      ...(item.originCountry ?? []),
      ...(item.originCountries ?? []),
      ...(item.origin_country ?? []),
    ],
    genres: [
      ...(item.genres ?? []),
      ...(item.genreIds ?? []),
      ...(item.genre_ids ?? []),
    ],
  };
}

/** The sole high-level membership check used by catalogue surfaces. */
export function matchesMediaCollectionWorld(
  item: MediaWorldPipelineItem,
  world: MediaCollectionWorld,
): boolean {
  return mediaCollectionWorldForItem(
    item,
    world === "standard-tv" || world === "arabic-tv" || world === "asian-tv" ? "tv" : "movie",
  ) === world;
}

export function mediaCollectionWorldForItem(
  item: MediaWorldPipelineItem,
  mediaType?: "movie" | "tv",
): MediaCollectionWorld {
  const declaresSeries = item.type === "series" || item.type === "tv" || item.media_type === "tv";
  const declaresMovie = item.type === "movie" || item.media_type === "movie";
  const isSeries = declaresSeries ? true : declaresMovie ? false : mediaType === "tv";
  return classifyMediaWorld(
    normalizedClassificationInput(item, isSeries ? "standard-tv" : "movies"),
  ).collectionWorld;
}

/**
 * Country priority for a collection world. The incoming order remains the
 * secondary order (date, popularity, rating, title, or a personal library
 * sort) inside each priority group.
 */
export function mediaCollectionWorldPriority(
  item: MediaWorldPipelineItem,
  world: MediaCollectionWorld,
): number {
  if (world === "arabic-movies" || world === "arabic-tv") {
    return arabicMediaCountryPriority(item);
  }
  if (world === "asian-movies" || world === "asian-tv") {
    return asianMediaCountryPriority(item);
  }
  if (world === "movies" || world === "standard-tv") {
    return standardMediaCountryPriority(item);
  }
  return 0;
}

export function prioritizeMediaCollectionWorldItems<T extends MediaWorldPipelineItem>(
  items: readonly T[],
  world: MediaCollectionWorld,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) =>
      mediaCollectionWorldPriority(left.item, world) - mediaCollectionWorldPriority(right.item, world)
      || left.index - right.index)
    .map(({ item }) => item);
}

/** One shared membership + ordering pipeline for every catalogue world. */
export function filterAndPrioritizeMediaCollectionWorldItems<T extends MediaWorldPipelineItem>(
  items: readonly T[],
  world: MediaCollectionWorld,
): T[] {
  return prioritizeMediaCollectionWorldItems(
    items.filter((item) => matchesMediaCollectionWorld(item, world)),
    world,
  );
}

/** Central policy for a mixed movie/TV row whose exact world varies per item. */
export function filterAndPrioritizeMediaCollectionWorldItemsBy<T extends MediaWorldPipelineItem>(
  items: readonly T[],
  worldFor: (item: T) => MediaCollectionWorld | null,
): T[] {
  return items
    .map((item, index) => ({ item, index, world: worldFor(item) }))
    .filter((entry): entry is { item: T; index: number; world: MediaCollectionWorld } =>
      entry.world != null && matchesMediaCollectionWorld(entry.item, entry.world))
    .sort((left, right) =>
      mediaCollectionWorldPriority(left.item, left.world) - mediaCollectionWorldPriority(right.item, right.world)
      || left.index - right.index)
    .map(({ item }) => item);
}
