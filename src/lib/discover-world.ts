import { isAnimeMediaItem } from "@/lib/anime-detect";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { isAsianMediaItem } from "@/lib/asian-media";
import type { MediaItem } from "@/lib/tmdb";

export type DiscoverWorld = "standard" | "arabic" | "asian" | "anime";

export function matchesDiscoverWorld(
  item: MediaItem,
  mediaType: "movie" | "tv",
  world: DiscoverWorld,
) {
  const isArabic = isArabicMediaItem(item);
  const isAnime = isAnimeMediaItem(item);
  if (mediaType !== "tv") {
    const isAsian = !isArabic && !isAnime && isAsianMediaItem(item);
    if (world === "arabic") return isArabic;
    if (world === "anime") return isAnime;
    if (world === "asian") return isAsian;
    return !isArabic && !isAnime && !isAsian;
  }

  const isAsian = !isArabic && !isAnime && isAsianMediaItem(item);
  if (world === "arabic") return isArabic;
  if (world === "anime") return isAnime;
  if (world === "asian") return isAsian;
  return !isArabic && !isAnime && !isAsian;
}
