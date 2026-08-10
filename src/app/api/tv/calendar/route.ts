import { NextRequest, NextResponse } from "next/server";
import { tmdb, type MediaItem } from "@/lib/tmdb";
import { parseDateOnly } from "@/lib/date-only";
import { discoverArabicCatalogueByCountryPriority } from "@/lib/arabic-discover";
import { ASIAN_COUNTRY_CODES, ASIAN_ORIGIN_COUNTRY_QUERY } from "@/lib/asian-media";
import { filterAndPrioritizeMediaCollectionWorldItems } from "@/lib/media-world-pipeline";
import type { MediaCollectionWorld } from "@/lib/media-world-classification";

const MAX_RANGE_DAYS = 370;
const MAX_PAGES = 5;
const ARABIC_TEXT = /[\u0600-\u06FF]/;
type TvCollectionWorld = Extract<MediaCollectionWorld, "standard-tv" | "arabic-tv" | "asian-tv" | "anime">;

function dayNumber(value: string) {
  const parts = parseDateOnly(value);
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000) : null;
}

function genreIds(value: string | null) {
  return value?.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0) || [];
}

function isTvCollectionWorld(value: string | null): value is TvCollectionWorld {
  return value === "standard-tv" || value === "arabic-tv" || value === "asian-tv" || value === "anime";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const language = (url.searchParams.get("language") as "ar" | "ja" | "en-US" | null) || undefined;
    const originalLanguage = url.searchParams.get("original_language") || undefined;
    const excludedOriginalLanguage = url.searchParams.get("exclude_original_language") || undefined;
    const requestedOriginCountry = url.searchParams.get("origin_country") || undefined;
    const genres = genreIds(url.searchParams.get("genre"));
    const withoutGenres = genreIds(url.searchParams.get("without_genre"));
    const requestedCollectionWorld = url.searchParams.get("collection_world");
    if (requestedCollectionWorld && !isTvCollectionWorld(requestedCollectionWorld)) {
      return NextResponse.json({ error: "Unsupported TV collection world." }, { status: 400 });
    }
    const collectionWorld: TvCollectionWorld = isTvCollectionWorld(requestedCollectionWorld)
      ? requestedCollectionWorld
      : (originalLanguage === "ar"
        ? "arabic-tv"
        : requestedOriginCountry === ASIAN_ORIGIN_COUNTRY_QUERY
          ? "asian-tv"
          : originalLanguage === "ja" && genres.includes(16)
            ? "anime"
            : "standard-tv");
    const originCountries = requestedOriginCountry === ASIAN_ORIGIN_COUNTRY_QUERY
      ? ASIAN_COUNTRY_CODES.join("|")
      : requestedOriginCountry;
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
      original_language: collectionWorld === "arabic-tv" ? "ar" : originalLanguage,
      originCountries,
      language,
    };

    const arabicPriorityCatalogue = collectionWorld === "arabic-tv"
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
    const items = filterAndPrioritizeMediaCollectionWorldItems(dateOrderedItems, collectionWorld);

    return NextResponse.json({
      from,
      to,
      collectionWorld,
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
