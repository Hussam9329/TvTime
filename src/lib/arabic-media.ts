import type { MediaItem } from "@/lib/tmdb";

export const ARABIC_LANGUAGE_CODE = "ar";

// ISO 3166-1 alpha-2 codes for Arab League members. Original language remains
// the strongest signal, while origin country catches productions whose TMDB
// language metadata is incomplete or multilingual.
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

export function detectIsArabic(input: ArabicDetectionInput): boolean {
  const language = String(input.originalLanguage || "").trim().toLowerCase();
  if (language === ARABIC_LANGUAGE_CODE) return true;
  return normalizeCountryCodes(input.originCountry).some((country) => ARAB_COUNTRY_CODES.has(country));
}

export function isArabicMediaItem(item: Pick<MediaItem, "original_language" | "origin_country">): boolean {
  return detectIsArabic({
    originalLanguage: item.original_language,
    originCountry: item.origin_country,
  });
}
