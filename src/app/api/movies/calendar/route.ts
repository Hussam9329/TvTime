import { NextRequest, NextResponse } from "next/server";
import { tmdb, type MediaItem } from "@/lib/tmdb";
import { parseDateOnly } from "@/lib/date-only";

const MAX_RANGE_DAYS = 370;
const MAX_PAGES = 5;

function dayNumber(value: string) {
  const parts = parseDateOnly(value);
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000) : null;
}

/**
 * General movie release calendar.
 * Query params:
 *   - from: YYYY-MM-DD (required)
 *   - to:   YYYY-MM-DD (required)
 *   - language: optional 'ar' | 'ja' | 'en-US' (default 'en-US')
 *   - original_language: optional filter (e.g. 'ar', 'en', 'ja')
 *
 * When language=ar is passed, TMDB returns Arabic titles + Arabic posters
 * (with fallback via include_image_language).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const language = (url.searchParams.get("language") as "ar" | "ja" | "en-US" | null) || undefined;
    const originalLanguage = url.searchParams.get("original_language") || undefined;
    const fromDay = dayNumber(from);
    const toDay = dayNumber(to);
    const days = fromDay == null || toDay == null ? null : toDay - fromDay + 1;

    if (!days || days < 1 || days > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `A valid from/to range of 1-${MAX_RANGE_DAYS} days is required.` }, { status: 400 });
    }

    const baseParams: Parameters<typeof tmdb.discoverMovies>[0] = {
      page: 1,
      sort_by: "primary_release_date.asc",
      vote_count_gte: 0,
      release_date_gte: from,
      release_date_lte: to,
      language,
    };
    if (originalLanguage) baseParams.original_language = originalLanguage;

    const first = await tmdb.discoverMovies(baseParams);
    const pages = Math.min(first.total_pages || 1, MAX_PAGES);
    const rest = pages > 1
      ? await Promise.all(Array.from({ length: pages - 1 }, (_, index) => tmdb.discoverMovies({
          ...baseParams,
          page: index + 2,
        })))
      : [];

    const fallbackPosterById = new Map<number, string>();
    if (language === "ar") {
      const fallbackPages = await Promise.all(Array.from({ length: pages }, (_, index) =>
        tmdb.discoverMovies({ ...baseParams, page: index + 1, language: "en-US" }),
      ));
      for (const item of fallbackPages.flatMap((page) => page.results || [])) {
        if (item.id && item.poster_path) fallbackPosterById.set(item.id, item.poster_path);
      }
    }

    const byId = new Map<number, MediaItem>();
    for (const item of [first, ...rest].flatMap((page) => page.results || [])) {
      if (!item.id || !item.release_date) continue;
      // If original_language filter was set, double-check server-side (TMDB is usually correct, but be safe).
      if (originalLanguage && item.original_language !== originalLanguage) continue;
      byId.set(item.id, {
        ...item,
        poster_path: item.poster_path || fallbackPosterById.get(item.id) || null,
        media_type: "movie",
      });
    }
    const items = [...byId.values()].sort((left, right) =>
      String(left.release_date || "").localeCompare(String(right.release_date || ""))
      || String(left.title || "").localeCompare(String(right.title || "")));

    return NextResponse.json({
      from,
      to,
      items,
      total: items.length,
      pagesFetched: pages,
      truncated: (first.total_pages || 1) > MAX_PAGES,
    }, { headers: { "Cache-Control": "private, max-age=900" } });
  } catch (error) {
    console.error("[movies:calendar]", error);
    return NextResponse.json({ error: "Failed to load the movie release schedule." }, { status: 500 });
  }
}
