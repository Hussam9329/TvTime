import { normalizeCountryCodes } from "@/lib/arabic-media";

export type StandardMediaPriorityInput = {
  originCountry?: string[] | null;
  originCountries?: string[] | null;
  origin_country?: string[] | null;
  originalLanguage?: string | null;
  original_language?: string | null;
};

export function standardMediaCountryPriority(item: StandardMediaPriorityInput) {
  const countries = normalizeCountryCodes([
    ...(item.originCountry ?? []),
    ...(item.originCountries ?? []),
    ...(item.origin_country ?? []),
  ]);

  if (countries.includes("US")) return 0;
  if (countries.includes("CA")) return 1;
  if (countries.includes("GB")) return 2;
  if (countries.includes("AU")) return 3;
  if (countries.includes("NZ")) return 4;
  if (countries.includes("IE")) return 5;
  if (String(item.originalLanguage || item.original_language || "").toLowerCase().split("-")[0] === "en") return 6;
  return 7;
}

export function sortByStandardMediaPriority<T extends StandardMediaPriorityInput>(items: readonly T[]): T[] {
  return [...items].sort(
    (left, right) => standardMediaCountryPriority(left) - standardMediaCountryPriority(right),
  );
}
