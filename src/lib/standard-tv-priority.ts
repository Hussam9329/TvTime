import type { MediaItem } from "@/lib/tmdb";

export function standardTvCountryPriority(item: MediaItem) {
  const countries = item.origin_country ?? [];

  if (countries.includes("US")) return 0;
  if (countries.includes("GB")) return 1;
  if (countries.includes("AU")) return 2;
  if (item.original_language === "en") return 3;
  return 4;
}
