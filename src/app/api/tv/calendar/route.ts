import { NextRequest, NextResponse } from "next/server";
import { tmdb, type MediaItem } from "@/lib/tmdb";
import { parseDateOnly } from "@/lib/date-only";
import { discoverArabicCatalogueByCountryPriority } from "@/lib/arabic-discover";
import { filterAndPrioritizeArabicMediaItems } from "@/lib/arabic-media";

const MAX_RANGE_DAYS = 370;
const MAX_PAGES = 5;
const ARABIC_TEXT = /[\u0600-\u06FF]/;

function dayNumber(value: string) {
  const parts = parseDateOnly(value);
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000) : null;
}

function genreIds(value: string | null) {
  return value?.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0) || [];
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const language = (url.searchParams.get("language") as "ar" | "ja" | "en-US" | null) || undefined;
    const originalLanguage = url.searchParams.get("original_language") || undefined;
    const excludedOriginalLanguage = url.searchParams.get("exclude_original_language") || undefined;
    const genres = genreIds(url.searchParams.get("genre"));
    const withoutGenres = genreIds(url.searchParams.get("without_genre"));
    const fromDay = dayNumber(from);
    const toDay = dayNumber(to);
    const days = fromDay == null || toDay == null ? null : toDay - fromDay + 1;

    if (!days || days < 1 || days > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `A valid from/to range of 1-${MAX_RANGE_DAYS} days is required.` }, { status: 400 });
    }

    const baseParams: Parameters<typeof tmdb.discoverTv>[0] = {
      page: 1,
      sort_by: "first_air_date.asc",
      vote_count_gte: 0,
      release_date_gte: from,
      release_date_lte: to,
      genres: genres.length ? genres : undefined,
      without_genres: withoutGenres.length ? withoutGenres : undefined,
      original_language: originalLanguage,
      language,
    };

    const arabicPriorityCatalogue = originalLanguage === "ar"
      ? await discoverArabicCatalogueByCountryPriority("tv", baseParams, MAX_PAGES * 20)
      : null;
    const first = arabicPriorityCatalogue ?? await tmdb.discoverTv(baseParams);
    const pages = arabicPriorityCatalogue
      ? arabicPriorityCatalogue.source_pages_fetched
      : Math.min(first.total_pages || 1, MAX_PAGES);
    const rest = !arabicPriorityCatalogue && pages > 1
      ? await Promise.all(Array.from({ length: pages - 1 }, (_, index) => tmdb.discoverTv({
          ...baseParams,
          page: index + 2,
        })))
      : [];

    const fallbackPosterById = new Map<number, string>();
    if (language === "ar" && !arabicPriorityCatalogue) {
      const fallbackPages = await Promise.all(Array.from({ length: pages }, (_, index) =>
        tmdb.discoverTv({ ...baseParams, page: index + 1, language: "en-US" }),
      ));
      for (const item of fallbackPages.flatMap((page) => page.results || [])) {
        if (item.id && item.poster_path) fallbackPosterById.set(item.id, item.poster_path);
      }
    }

    const byId = new Map<number, MediaItem>();
    for (const item of [first, ...rest].flatMap((page) => page.results || [])) {
      if (!item.id || !item.first_air_date) continue;
      if (originalLanguage && item.original_language !== originalLanguage) continue;
      if (excludedOriginalLanguage && item.original_language === excludedOriginalLanguage) continue;
      byId.set(item.id, {
        ...item,
        name: ARABIC_TEXT.test(item.name || "")
          ? item.name
          : ARABIC_TEXT.test(item.original_name || "") ? item.original_name : item.name,
        poster_path: item.poster_path || fallbackPosterById.get(item.id) || null,
        media_type: "tv",
      });
    }
    const dateOrderedItems = [...byId.values()].sort((left, right) =>
      String(left.first_air_date || "").localeCompare(String(right.first_air_date || ""))
      || String(left.name || "").localeCompare(String(right.name || "")));
    const items = originalLanguage === "ar"
      ? filterAndPrioritizeArabicMediaItems(dateOrderedItems)
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
    console.error("[tv:calendar]", error);
    return NextResponse.json({ error: "Failed to load the TV release schedule." }, { status: 500 });
  }
}
