const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateOnlyParts = {
  year: number;
  month: number;
  day: number;
};

export function parseDateOnly(value?: string | null): DateOnlyParts | null {
  const match = DATE_ONLY_PATTERN.exec(String(value || "").trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year
    || utc.getUTCMonth() !== month - 1
    || utc.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function dateOnlyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnlyToLocalDate(value?: string | null): Date | null {
  const parts = parseDateOnly(value);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
}

export function addDaysToDateOnly(value: string, amount: number): string | null {
  const date = dateOnlyToLocalDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + amount);
  return dateOnlyFromLocalDate(date);
}

export function formatDateOnly(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
  locale = "en-US",
): string | null {
  const parts = parseDateOnly(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
}

export function formatReleaseDateParts(value?: string | null, locale = "en-GB") {
  const parts = parseDateOnly(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return {
    dayMonth: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date),
    year: String(parts.year),
    full: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
  };
}

export function compareDateOnly(left?: string | null, right?: string | null): number {
  const a = parseDateOnly(left) ? String(left) : "";
  const b = parseDateOnly(right) ? String(right) : "";
  return a.localeCompare(b);
}
