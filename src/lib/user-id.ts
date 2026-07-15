export const DEFAULT_USER_ID = "cinetrack_default";

export function sanitizeUserId(userId?: string | null): string {
  const trimmed = String(userId || "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : DEFAULT_USER_ID;
}
