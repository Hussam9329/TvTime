"use client";

export type UserPreferences = {
  timezone: string;
};

const STORAGE_KEY = "tvtime-preferences";
export const USER_PREFERENCES_EVENT = "tvtime:user-preferences";

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  timezone: "Asia/Baghdad",
};

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeUserPreferences(value: unknown): UserPreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const timezoneCandidate = String(source.timezone || DEFAULT_USER_PREFERENCES.timezone).trim();
  return {
    timezone: validTimezone(timezoneCandidate) ? timezoneCandidate : DEFAULT_USER_PREFERENCES.timezone,
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
