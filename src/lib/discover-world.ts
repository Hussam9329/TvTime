import {
  collectionWorldForCatalogue,
  matchesMediaCollectionWorld,
} from "@/lib/media-world-pipeline";
import type { MediaItem } from "@/lib/tmdb";

export type DiscoverWorld = "standard" | "arabic" | "asian" | "anime";

export function matchesDiscoverWorld(
  item: MediaItem,
  mediaType: "movie" | "tv",
  world: DiscoverWorld,
) {
  return matchesMediaCollectionWorld(item, collectionWorldForCatalogue(world, mediaType));
}
