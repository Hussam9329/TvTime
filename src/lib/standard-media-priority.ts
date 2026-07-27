import type { MediaItem } from "@/lib/tmdb";

export function standardMediaCountryPriority(item: MediaItem) {
  const countries = item.origin_country ?? [];

  if (countries.includes("US")) return 0;
  if (countries.includes("CA")) return 1;
  if (countries.includes("GB")) return 2;
  if (countries.includes("AU")) return 3;
  if (countries.includes("NZ")) return 4;
  if (countries.includes("IE")) return 5;
  if (item.original_language === "en") return 6;
  return 7;
}

export function sortByStandardMediaPriority(items: MediaItem[]) {
  return [...items].sort(
    (left, right) => standardMediaCountryPriority(left) - standardMediaCountryPriority(right),
  );
}
