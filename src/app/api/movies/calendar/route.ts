import { NextRequest, NextResponse } from "next/server";
import { tmdb, type MediaItem } from "@/lib/tmdb";
import { parseDateOnly } from "@/lib/date-only";
import { ASIAN_COUNTRY_CODES, ASIAN_ORIGIN_COUNTRY_QUERY } from "@/lib/asian-media";
import { discoverArabicCatalogueByCountryPriority } from "@/lib/arabic-discover";
import { filterAndPrioritizeMediaCollectionWorldItems } from "@/lib/media-world-pipeline";
import type { MediaCollectionWorld } from "@/lib/media-world-classification";

const MAX_RANGE_DAYS = 370;
const MAX_PAGES = 5;
const ARABIC_TEXT = /[\u0600-\u06FF]/;

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
    const originCountry = url.searchParams.get("origin_country") || undefined;
    const genres = (url.searchParams.get("genre") || "")
      .split(",")
      .map(Number)
      .filter((genre) => Number.isInteger(genre) && genre > 0);
    const requestedCollectionWorld = url.searchParams.get("collection_world") as MediaCollectionWorld | null;
    const movieCollectionWorlds = new Set<MediaCollectionWorld>(["movies", "asian-movies", "arabic-movies", "anime"]);
    if (requestedCollectionWorld && !movieCollectionWorlds.has(requestedCollectionWorld)) {
      return NextResponse.json({ error: "Unsupported movie collection world." }, { status: 400 });
    }
    const collectionWorld: MediaCollectionWorld | null = requestedCollectionWorld || (originCountry === ASIAN_ORIGIN_COUNTRY_QUERY
      ? "asian-movies"
      : originalLanguage === "ar"
        ? "arabic-movies"
        : originalLanguage === "ja" && genres.includes(16)
          ? "anime"
          : originalLanguage
            ? null
            : "movies");
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
      genres: genres.length ? genres : undefined,
    };
    if (originalLanguage) baseParams.original_language = originalLanguage;
    if (originCountry) baseParams.originCountries = originCountry === ASIAN_ORIGIN_COUNTRY_QUERY
      ? ASIAN_COUNTRY_CODES.join("|")
      : originCountry;

    const arabicPriorityCatalogue = originalLanguage === "ar" && !originCountry
      ? await discoverArabicCatalogueByCountryPriority("movie", baseParams, MAX_PAGES * 20)
      : null;
    const first = arabicPriorityCatalogue ?? await tmdb.discoverMovies(baseParams);
    const pages = arabicPriorityCatalogue
      ? arabicPriorityCatalogue.source_pages_fetched
      : Math.min(first.total_pages || 1, MAX_PAGES);
    const rest = arabicPriorityCatalogue || pages <= 1
      ? []
      : await Promise.all(Array.from({ length: pages - 1 }, (_, index) => tmdb.discoverMovies({
          ...baseParams,
          page: index + 2,
        })));

    const fallbackPosterById = new Map<number, string>();
    if (language === "ar" && !arabicPriorityCatalogue) {
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
        title: ARABIC_TEXT.test(item.title || "")
          ? item.title
          : ARABIC_TEXT.test(item.original_title || "") ? item.original_title : item.title,
        poster_path: item.poster_path || fallbackPosterById.get(item.id) || null,
        media_type: "movie",
      });
    }
    const dateOrderedItems = [...byId.values()].sort((left, right) =>
      String(left.release_date || "").localeCompare(String(right.release_date || ""))
      || String(left.title || "").localeCompare(String(right.title || "")));
    const items = collectionWorld
      ? filterAndPrioritizeMediaCollectionWorldItems(dateOrderedItems, collectionWorld)
      : dateOrderedItems;

    return NextResponse.json({
      from,
      to,
      items,
      total: items.length,
      pagesFetched: pages,
      truncated: arabicPriorityCatalogue
        ? arabicPriorityCatalogue.total_results > items.length
        : (first.total_pages || 1) > MAX_PAGES,
    }, { headers: { "Cache-Control": "private, max-age=900" } });
  } catch (error) {
    console.error("[movies:calendar]", error);
    return NextResponse.json({ error: "Failed to load the movie release schedule." }, { status: 500 });
  }
}
