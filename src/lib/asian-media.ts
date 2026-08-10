export const ASIAN_COUNTRY_CODES = [
  "KR", "JP", "CN", "TW", "HK", "MO", "TH", "IN", "PK", "BD", "LK", "NP",
  "ID", "MY", "SG", "PH", "VN", "KH", "MM", "MN", "KZ", "UZ", "KG", "TJ",
] as const;

export const ASIAN_LANGUAGE_CODES = [
  "ko", "ja", "zh", "th", "hi", "ur", "bn", "ta", "te", "ml", "kn", "id",
  "ms", "tl", "vi", "km", "my", "mn", "kk", "uz",
] as const;

const ASIAN_COUNTRIES = new Set<string>(ASIAN_COUNTRY_CODES);
const ASIAN_LANGUAGES = new Set<string>(ASIAN_LANGUAGE_CODES);

export const ASIAN_ORIGIN_COUNTRY_QUERY = "__ASIA_PRIORITY__";

export function isAsianMediaItem(item: {
  original_language?: string | null;
  originalLanguage?: string | null;
  origin_country?: string[] | null;
  originCountries?: string[] | null;
}) {
  const countries = [
    ...(item.origin_country ?? []),
    ...(item.originCountries ?? []),
  ]
    .map((country) => String(country).trim().toUpperCase())
    .filter(Boolean);
  const language = String(item.original_language || item.originalLanguage || "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  // TMDB origin-country metadata is authoritative. Asian TV is intentionally
  // strict: every declared origin country must be Asian. A mixed production
  // such as SG + US belongs to standard TV, not Asian TV. Language is only a
  // fallback for incomplete search/discover items that omit origin_country.
  if (countries.length > 0) {
    return countries.every((country) => ASIAN_COUNTRIES.has(country));
  }
  return ASIAN_LANGUAGES.has(language);
}

export function asianMediaCountryPriority(item: {
  originCountry?: string[] | null;
  origin_country?: string[] | null;
  originCountries?: string[] | null;
  originalLanguage?: string | null;
  original_language?: string | null;
}) {
  const countries = [
    ...(item.originCountry ?? []),
    ...(item.origin_country ?? []),
    ...(item.originCountries ?? []),
  ]
    .map((country) => String(country).trim().toUpperCase());
  if (countries.includes("KR")) return 0;
  if (countries.includes("JP")) return 1;
  if (countries.includes("CN")) return 2;
  const language = String(item.originalLanguage || item.original_language || "")
    .trim().toLowerCase().split("-")[0];
  if (language === "ko") return 0;
  if (language === "ja") return 1;
  if (language === "zh") return 2;
  return 3;
}
