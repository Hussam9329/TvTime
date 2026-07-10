"use client";

// TVM-35/36/37: User preferences stored in localStorage.
// Defaults: Iraq timezone (Asia/Baghdad), Iraq country code (IQ), no platform prefs.

export type UserPreferences = {
  // TVM-35: IANA timezone for displaying episode air dates/times
  timezone: string;
  // TVM-36: ISO 3166-1 alpha-2 country code for Watch Providers
  country: string;
  // TVM-37: Preferred streaming platforms (TMDB provider IDs or names)
  preferredPlatforms: string[];
};

const STORAGE_KEY = "tvtime-preferences";

const DEFAULTS: UserPreferences = {
  timezone: "Asia/Baghdad",
  country: "IQ",
  preferredPlatforms: [],
};

export function getUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      timezone: parsed.timezone || DEFAULTS.timezone,
      country: parsed.country || DEFAULTS.country,
      preferredPlatforms: Array.isArray(parsed.preferredPlatforms) ? parsed.preferredPlatforms : [],
    };
  } catch {
    return DEFAULTS;
  }
}

export function setUserPreferences(prefs: Partial<UserPreferences>): UserPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  const current = getUserPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// TVM-35: Convert a UTC date string to the user's local timezone display
export function formatInUserTimezone(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const prefs = getUserPreferences();
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: prefs.timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    }).format(d);
  } catch {
    return d.toLocaleDateString("en-US", options);
  }
}

// TVM-35: Format date + time in user timezone
export function formatDateTimeInUserTimezone(date: Date | string): string {
  return formatInUserTimezone(date, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Common country options for the settings dropdown
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
  { value: "Asia/Cairo", label: "Egypt (Asia/Cairo, GMT+2)" },
  { value: "Europe/Istanbul", label: "Turkey (Europe/Istanbul, GMT+3)" },
  { value: "America/New_York", label: "US Eastern (GMT-5)" },
  { value: "America/Los_Angeles", label: "US Pacific (GMT-8)" },
  { value: "Europe/London", label: "UK (GMT+0)" },
  { value: "Europe/Berlin", label: "Germany (GMT+1)" },
  { value: "Asia/Tokyo", label: "Japan (GMT+9)" },
  { value: "Asia/Kolkata", label: "India (GMT+5:30)" },
];
