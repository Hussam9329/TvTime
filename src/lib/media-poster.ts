const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_FILE_PATTERN = /^\/[A-Za-z0-9._~-]+\.(?:avif|gif|jpe?g|png|webp)$/i;
const LOCAL_PREFIXES = ["/placeholder-", "/assets/", "/images/", "/uploads/", "/icons/"];

export function canonicalMediaPoster(value: unknown, size = "w500"): string | null {
  if (typeof value !== "string") return null;
  const poster = value.trim();
  if (!poster) return null;
  if (/^(?:https?:|data:|blob:)/i.test(poster)) return poster;
  if (poster.startsWith("//")) return `https:${poster}`;
  if (LOCAL_PREFIXES.some((prefix) => poster.startsWith(prefix))) return poster;
  if (TMDB_FILE_PATTERN.test(poster)) return `${TMDB_IMAGE_BASE}/${size}${poster}`;
  return poster;
}
