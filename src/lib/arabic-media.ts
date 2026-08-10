const ARABIC_LANGUAGE_CODE = "ar";

// This is the sole country-order definition used by TMDB retrieval and every
// rendered Arabic list: Egypt, Syria, Lebanon, Iraq, Gulf, then other Arab
// League countries.
export const ARABIC_COUNTRY_PRIORITY_GROUPS = [
  ["EG"],
  ["SY"],
  ["LB"],
  ["IQ"],
  ["SA", "AE", "KW", "QA", "BH", "OM"],
  ["DZ", "KM", "DJ", "JO", "LY", "MR", "MA", "PS", "SO", "SD", "TN", "YE"],
] as const;

export const ARABIC_COUNTRY_PRIORITY = ARABIC_COUNTRY_PRIORITY_GROUPS
  .map((countries) => countries.join("|"));

const ARAB_COUNTRY_CODES = new Set<string>(ARABIC_COUNTRY_PRIORITY_GROUPS.flat());

type ArabicDetectionInput = {
  originalLanguage?: string | null;
  originCountry?: string[] | null;
};

export type ArabicMediaMetadataInput = {
  originalLanguage?: string | null;
  original_language?: string | null;
  originCountry?: string[] | null;
  originCountries?: string[] | null;
  origin_country?: string[] | null;
};

export function normalizeCountryCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((country) => String(country || "").trim().toUpperCase())
      .filter(Boolean),
  ));
}

export function arabicMediaOriginalLanguage(item: ArabicMediaMetadataInput): string | null {
  const candidates = [item.originalLanguage, item.original_language];
  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim().toLowerCase();
    if (normalized) return normalized;
  }
  return null;
}

export function arabicMediaOriginCountries(item: ArabicMediaMetadataInput): string[] {
  return normalizeCountryCodes([
    ...(item.originCountry ?? []),
    ...(item.originCountries ?? []),
    ...(item.origin_country ?? []),
  ]);
}

// Arabic originals are works whose primary language is Arabic. Origin country
// alone is intentionally NOT enough: many foreign productions are shot or
// co-produced in Arab countries without being Arabic-language originals.
export function detectIsArabic(input: ArabicDetectionInput): boolean {
  const language = String(input.originalLanguage || "").trim().toLowerCase();
  const countries = normalizeCountryCodes(input.originCountry);
  if (language !== ARABIC_LANGUAGE_CODE) return false;

  // If TMDB supplied production countries, at least one must belong to the
  // Arab League. This rejects dubbed/incorrectly tagged foreign productions.
  // Language-only fallback remains for older rows and sparse search results
  // whose country metadata has not been populated yet.
  return countries.length === 0
    || countries.some((country) => ARAB_COUNTRY_CODES.has(country));
}

export function isArabicMediaItem(item: ArabicMediaMetadataInput): boolean {
  return detectIsArabic({
    originalLanguage: arabicMediaOriginalLanguage(item),
    originCountry: arabicMediaOriginCountries(item),
  });
}

export function arabicMediaCountryPriority(item: ArabicMediaMetadataInput): number {
  const countries = arabicMediaOriginCountries(item);
  const priority = ARABIC_COUNTRY_PRIORITY_GROUPS.findIndex((group) =>
    group.some((country) => countries.includes(country)));
  return priority === -1 ? ARABIC_COUNTRY_PRIORITY_GROUPS.length : priority;
}

export function compareArabicMediaByCountryPriority(
  left: ArabicMediaMetadataInput,
  right: ArabicMediaMetadataInput,
): number {
  return arabicMediaCountryPriority(left) - arabicMediaCountryPriority(right);
}

/**
 * Canonical Egypt-first ordering for every Arabic surface. JavaScript sorting
 * is stable, so the caller's own order (date, title, rating, etc.) remains the
 * secondary order inside each country-priority group.
 */
export function prioritizeArabicMediaItems<T extends ArabicMediaMetadataInput>(items: readonly T[]): T[] {
  return [...items].sort(compareArabicMediaByCountryPriority);
}

/** One shared filter + ordering pipeline for Arabic catalogues and lists. */
export function filterAndPrioritizeArabicMediaItems<T extends ArabicMediaMetadataInput>(items: readonly T[]): T[] {
  return prioritizeArabicMediaItems(items.filter(isArabicMediaItem));
}
