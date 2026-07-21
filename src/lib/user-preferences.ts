"use client";

export type UserPreferences = {
  timezone: string;
  country: string;
  preferredPlatforms: string[];
};

const STORAGE_KEY = "tvtime-preferences";
export const USER_PREFERENCES_EVENT = "tvtime:user-preferences";

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  timezone: "Asia/Baghdad",
  country: "IQ",
  preferredPlatforms: [],
};

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeUserPreferences(value: unknown): UserPreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const timezoneCandidate = String(source.timezone || DEFAULT_USER_PREFERENCES.timezone).trim();
  const countryCandidate = String(source.country || DEFAULT_USER_PREFERENCES.country).trim().toUpperCase();
  const platforms = Array.isArray(source.preferredPlatforms)
    ? source.preferredPlatforms.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
  return {
    timezone: validTimezone(timezoneCandidate) ? timezoneCandidate : DEFAULT_USER_PREFERENCES.timezone,
    country: /^[A-Z]{2}$/.test(countryCandidate) ? countryCandidate : DEFAULT_USER_PREFERENCES.country,
    preferredPlatforms: [...new Set(platforms)].slice(0, 100),
  };
}

function cachePreferences(preferences: UserPreferences, notify = true): UserPreferences {
  if (typeof window === "undefined") return preferences;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  if (notify) window.dispatchEvent(new CustomEvent(USER_PREFERENCES_EVENT, { detail: preferences }));
  return preferences;
}

export function getUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeUserPreferences(JSON.parse(raw)) : DEFAULT_USER_PREFERENCES;
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

/** Update the local cache immediately. Use saveUserPreferences for account sync. */
export function setUserPreferences(prefs: Partial<UserPreferences>): UserPreferences {
  return cachePreferences(normalizeUserPreferences({ ...getUserPreferences(), ...prefs }));
}

export async function fetchUserPreferences(): Promise<UserPreferences> {
  const response = await fetch("/api/user", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load account preferences");
  const payload = await response.json();
  return cachePreferences(normalizeUserPreferences(payload?.user));
}

export async function saveUserPreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const next = normalizeUserPreferences({ ...getUserPreferences(), ...prefs });
  const response = await fetch("/api/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to save preferences");
  return cachePreferences(normalizeUserPreferences(payload?.user));
}

export function formatInTimezone(
  date: Date | string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: validTimezone(timezone) ? timezone : DEFAULT_USER_PREFERENCES.timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    }).format(value);
  } catch {
    return value.toLocaleDateString("en-US", options);
  }
}

export function formatInUserTimezone(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return formatInTimezone(date, getUserPreferences().timezone, options);
}

export function formatDateTimeInUserTimezone(date: Date | string): string {
  return formatInUserTimezone(date, { hour: "2-digit", minute: "2-digit" });
}

export const COUNTRY_OPTIONS = [
  { code: "IQ", name: "Iraq" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "EG", name: "Egypt" },
  { code: "TR", name: "Turkey" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
];

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Baghdad", label: "Iraq (Asia/Baghdad, GMT+3)" },
  { value: "Asia/Dubai", label: "UAE (Asia/Dubai, GMT+4)" },
  { value: "Asia/Riyadh", label: "Saudi Arabia (Asia/Riyadh, GMT+3)" },
  { value: "Africa/Cairo", label: "Egypt (Africa/Cairo)" },
  { value: "Europe/Istanbul", label: "Turkey (Europe/Istanbul, GMT+3)" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/London", label: "United Kingdom" },
  { value: "Europe/Berlin", label: "Germany" },
  { value: "Asia/Tokyo", label: "Japan (GMT+9)" },
  { value: "Asia/Kolkata", label: "India (GMT+5:30)" },
];
