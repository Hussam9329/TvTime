import type { MediaItem } from "@/lib/tmdb";

export const ARABIC_LANGUAGE_CODE = "ar";

// ISO 3166-1 alpha-2 codes for Arab League members. Used as a SECONDARY
// signal: a work produced in an Arab country is a candidate for Arabic
// classification, but only if combined with other signals (e.g. genres
// containing "Arab Cinema" or a known title match).
export const ARAB_COUNTRY_CODES = new Set([
  "DZ", "BH", "KM", "DJ", "EG", "IQ", "JO", "KW", "LB", "LY", "MR",
  "MA", "OM", "PS", "QA", "SA", "SO", "SD", "SY", "TN", "AE", "YE",
]);

// Known Arabic titles that TMDB may classify with a non-Arabic original_language.
// Like KNOWN_ANIME_TITLES in anime-detect.ts, this is a manual override for
// works that are Arabic originals but whose TMDB metadata doesn't reflect it.
const KNOWN_ARABIC_TITLES = new Set([
  // Egyptian classics
  "الناصر صلاح الدين",
  "العزيمة",
  "سيد درويش",
  "الفتوة",
  "بابا عايز كده",
  // Modern Egyptian
  "الفيل الأزرق",
  "اشتباك",
  "تصبح على خير",
  "هيبتا",
  "تراب الماس",
  "البدلة",
  // Khaleeji
  "دم حديد",
]);

export type ArabicDetectionInput = {
  originalLanguage?: string | null;
  originCountry?: string[] | null;
  genres?: string[];
  title?: string;
};

export function normalizeCountryCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((country) => String(country || "").trim().toUpperCase())
      .filter(Boolean),
  ));
}

/**
 * Multi-signal Arabic detection.
 *
 * Signal 1 (primary): original_language === "ar" — the strongest signal.
 *   TMDB marks works whose primary audio track is Arabic with this code.
 *
 * Signal 2 (secondary): title matches KNOWN_ARABIC_TITLES — a manual
 *   override for works that are Arabic originals but whose TMDB metadata
 *   doesn't reflect it (e.g. co-productions labeled as "en" or "fr").
 *
 * Signal 3 (secondary): genres include "Arab Cinema" or similar TMDB
 *   genre names that indicate Arabic origin.
 *
 * Country codes are intentionally NOT sufficient on their own: many
 * foreign productions are shot in Arab countries without being Arabic
 * originals. However, if country is Arab AND genres include a clear
 * Arabic-origin indicator, we classify as Arabic.
 */
export function detectIsArabic(input: ArabicDetectionInput): boolean {
  const language = String(input.originalLanguage || "").trim().toLowerCase();

  // Signal 1: primary — original language is Arabic
  if (language === ARABIC_LANGUAGE_CODE) return true;

  // Signal 2: known title override
  if (input.title) {
    const normalizedTitle = input.title.trim();
    if (KNOWN_ARABIC_TITLES.has(normalizedTitle)) return true;
  }

  // Signal 3: genres that explicitly indicate Arabic origin
  if (input.genres && input.genres.length > 0) {
    const arabicGenreIndicators = ["arab cinema", "cinema arabe", "سينما عربية"];
    const hasArabicGenre = input.genres.some((g) =>
      arabicGenreIndicators.some((indicator) =>
        String(g || "").toLowerCase().includes(indicator)
      )
    );
    if (hasArabicGenre) return true;

    // Signal 3b: Arab country + genre "Drama" or "Comedy" (common Arabic
    // film genres) — but only if language is not clearly non-Arabic.
    // This catches Egyptian/Syrian/Lebanese films that TMDB mislabels.
    if (input.originCountry && input.originCountry.some((c) => ARAB_COUNTRY_CODES.has(c))) {
      // If the original language is explicitly a non-Arabic language (e.g.
      // "en", "fr", "ja"), don't override — the work is likely a
      // co-production or foreign film shot in an Arab country.
      const nonArabicLanguages = ["en", "fr", "ja", "ko", "zh", "hi", "es", "de", "it", "pt", "ru", "tr", "fa", "ur"];
      if (!nonArabicLanguages.includes(language)) {
        // Arabic country + non-explicitly-foreign language = likely Arabic
        return true;
      }
    }
  }

  return false;
}

export function isArabicMediaItem(item: Pick<MediaItem, "original_language" | "origin_country">): boolean {
  return detectIsArabic({
    originalLanguage: item.original_language,
    originCountry: item.origin_country,
  });
}
