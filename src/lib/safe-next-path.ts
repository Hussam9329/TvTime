const FALLBACK_PATH = "/";
const VALIDATION_ORIGIN = "https://tvtime.invalid";

/**
 * Accept only a same-origin application path for post-login navigation.
 * Absolute URLs, protocol-relative URLs, backslashes and control characters are
 * rejected. The returned value is normalized to pathname + search + hash.
 */
export function safeNextPath(value: string | null | undefined, fallback = FALLBACK_PATH): string {
  const candidate = String(value ?? "").trim();
  if (!candidate || candidate.length > 2048) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  try {
    const parsed = new URL(candidate, VALIDATION_ORIGIN);
    if (parsed.origin !== VALIDATION_ORIGIN) return fallback;
    if (!parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
