const ASIAN_COUNTRIES = new Set([
  "KR", "JP", "CN", "TW", "HK", "MO", "TH", "IN", "PK", "BD", "LK", "NP",
  "ID", "MY", "SG", "PH", "VN", "KH", "MM", "MN", "KZ", "UZ", "KG", "TJ",
]);

const ASIAN_LANGUAGES = new Set([
  "ko", "ja", "zh", "th", "hi", "ur", "bn", "ta", "te", "ml", "kn", "id",
  "ms", "tl", "vi", "km", "my", "mn", "kk", "uz",
]);

export const ASIAN_ORIGIN_COUNTRY_QUERY = [...ASIAN_COUNTRIES].join("|");

export function isAsianMediaItem(item: {
  original_language?: string | null;
  originalLanguage?: string | null;
  origin_country?: string[] | null;
  originCountries?: string[] | null;
}) {
  const countries = item.origin_country ?? item.originCountries ?? [];
  const language = item.original_language ?? item.originalLanguage ?? "";
  return countries.some((country) => ASIAN_COUNTRIES.has(country)) || ASIAN_LANGUAGES.has(language);
}

export function asianMediaCountryPriority(item: { origin_country?: string[] | null; originCountries?: string[] | null }) {
  const countries = item.origin_country ?? item.originCountries ?? [];
  if (countries.includes("KR")) return 0;
  if (countries.includes("JP")) return 1;
  if (countries.includes("CN")) return 2;
  return 3;
}
