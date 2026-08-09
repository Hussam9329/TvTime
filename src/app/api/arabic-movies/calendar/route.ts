import { NextRequest, NextResponse } from "next/server";
import type { MediaItem } from "@/lib/tmdb";
import { parseDateOnly } from "@/lib/date-only";
import { discoverArabicCatalogueByCountryPriority } from "@/lib/arabic-discover";
import { arabicMediaCountryPriority } from "@/lib/arabic-media";

const MAX_RANGE_DAYS = 370;
const MAX_PAGES = 5;

function dayNumber(value: string) {
  const parts = parseDateOnly(value);
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000) : null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const fromDay = dayNumber(from);
    const toDay = dayNumber(to);
    const days = fromDay == null || toDay == null ? null : toDay - fromDay + 1;

    if (!days || days < 1 || days > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `A valid from/to range of 1-${MAX_RANGE_DAYS} days is required.` }, { status: 400 });
    }

    const catalogue = await discoverArabicCatalogueByCountryPriority("movie", {
      sort_by: "primary_release_date.asc",
      original_language: "ar",
      vote_count_gte: 0,
      release_date_gte: from,
      release_date_lte: to,
      // Pass language=ar so TMDB returns Arabic titles + Arabic posters.
      language: "ar",
    }, MAX_PAGES * 20);

    const byId = new Map<number, MediaItem>();
    for (const item of catalogue.results || []) {
      if (!item.id || !item.release_date || item.original_language !== "ar") continue;
      byId.set(item.id, { ...item, media_type: "movie" });
    }
    const items = [...byId.values()].sort((left, right) =>
      arabicMediaCountryPriority(left) - arabicMediaCountryPriority(right)
      || String(left.release_date || "").localeCompare(String(right.release_date || ""))
      || String(left.title || "").localeCompare(String(right.title || "")));

    return NextResponse.json({
      from,
      to,
      items,
      total: items.length,
      pagesFetched: catalogue.source_pages_fetched,
      truncated: catalogue.total_results > items.length,
    }, { headers: { "Cache-Control": "private, max-age=900" } });
  } catch (error) {
    console.error("[arabic-movies:calendar]", error);
    return NextResponse.json({ error: "Failed to load the Arabic movie release schedule." }, { status: 500 });
  }
}
