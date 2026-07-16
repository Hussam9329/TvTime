import type { MediaItem } from "@/lib/tmdb";

export const ARABIC_LANGUAGE_CODE = "ar";

// ISO 3166-1 alpha-2 codes for Arab League members. Kept for normalization
// and metadata storage, but Arabic classification now requires the work's
// original language to be Arabic. Origin country alone is too noisy a signal:
// many foreign films are produced or shot in Arab countries (e.g. The
// Hundred-Foot Journey, Contagion) without being Arabic originals.
export const ARAB_COUNTRY_CODES = new Set([
  "DZ", "BH", "KM", "DJ", "EG", "IQ", "JO", "KW", "LB", "LY", "MR",
  "MA", "OM", "PS", "QA", "SA", "SO", "SD", "SY", "TN", "AE", "YE",
]);

export type ArabicDetectionInput = {
  originalLanguage?: string | null;
  originCountry?: string[] | null;
};

export function normalizeCountryCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((country) => String(country || "").trim().toUpperCase())
      .filter(Boolean),
  ));
}

// Arabic originals are works whose primary language is Arabic. Origin country
// alone is intentionally NOT enough: many foreign productions are shot or
// co-produced in Arab countries without being Arabic-language originals.
export function detectIsArabic(input: ArabicDetectionInput): boolean {
  const language = String(input.originalLanguage || "").trim().toLowerCase();
  return language === ARABIC_LANGUAGE_CODE;
}

export function isArabicMediaItem(item: Pick<MediaItem, "original_language" | "origin_country">): boolean {
  return detectIsArabic({
    originalLanguage: item.original_language,
    originCountry: item.origin_country,
  });
}
