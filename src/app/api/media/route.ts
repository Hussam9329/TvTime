import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { normalizeMediaMany } from "@/lib/media-normalize";
import type { Prisma } from "@prisma/client";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { prioritizeArabicMediaItems } from "@/lib/arabic-media";
import {
  recordMatchesMediaClassification,
  type MediaClassificationFilters,
} from "@/lib/media-world-classification";

const SORTABLE_FIELDS = new Set(["addedAt", "updatedAt", "userRating", "title", "year", "watchedAt"]);
const ORDERS = new Set(["asc", "desc"]);

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const watched = url.searchParams.get("watched");
    const rated = url.searchParams.get("rated");
    const tracked = url.searchParams.get("tracked");
    const search = url.searchParams.get("search")?.trim();
    const sortByParam = url.searchParams.get("sortBy") || "addedAt";
    const orderParam = url.searchParams.get("order") || "desc";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const where: Prisma.MediaWhereInput = { userId: user.id };
    if (type && type !== "undefined" && type !== "all") where.type = type;
    if (status && status !== "all" && status !== "undefined") {
      // Support comma-separated statuses when callers intentionally request multiple states.
      if (status.includes(",")) {
        where.status = { in: status.split(",").map((s) => s.trim()).filter(Boolean) };
      } else {
        // Watchlist is a strict state, not "anything unrated". Requiring
        // watched=false also protects against stale legacy rows that carried
        // both Planned and Watched at once.
        where.status = status;
        if (status === "planned") where.watched = false;
      }
    }
    if (watched === "true") where.watched = true;
    if (watched === "false") where.watched = false;
    if (rated === "true") where.userRating = { not: null };
    if (rated === "false") where.userRating = null;
    if (tracked === "true") where.isFollowing = true;
    if (tracked === "false") where.isFollowing = false;

    const booleanFilter = (value: string | null): boolean | undefined =>
      value === "true" ? true : value === "false" ? false : undefined;
    const isAnime = url.searchParams.get("isAnime");
    const isAsian = url.searchParams.get("isAsian");
    const isArabic = url.searchParams.get("isArabic");
    const classificationFilters: MediaClassificationFilters = {
      isAnime: booleanFilter(isAnime),
      isArabic: booleanFilter(isArabic),
      isAsian: booleanFilter(isAsian),
    };
    if (search) where.title = { contains: search };

    const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "addedAt";
    const order = ORDERS.has(orderParam) ? orderParam : "desc";

    // Classification happens after the ordinary database predicates so every
    // My Media surface uses the same canonical classifier. We deliberately
    // paginate after classification; filtering a single DB page first can
    // produce wrong totals and let stale rows leak between collection worlds.
    const candidates = await db.media.findMany({ where, orderBy: { [sortBy]: order } });
    const classifiedCandidates = await resolveGeneralMediaClassifications(candidates, { allowNetwork: false });
    const matchingItems = classifiedCandidates.filter((item) =>
      recordMatchesMediaClassification(item, classificationFilters));
    // Every Arabic library pagination path is Egypt-first across the complete
    // result set, then preserves the user's selected order within each group.
    // Sorting before slicing prevents non-Egyptian titles from occupying the
    // first page while Egyptian titles remain on later pages.
    const prioritizedItems = classificationFilters.isArabic === true
      ? prioritizeArabicMediaItems(matchingItems)
      : matchingItems;
    const total = prioritizedItems.length;
    const items = prioritizedItems.slice(offset, offset + limit);

    // Anime series may have been saved while the catalogue incorrectly used
    // Japanese as its display locale. TvMetadataCache is populated from the
    // canonical en-US TMDB profile, so one batch read repairs presentation for
    // existing libraries without one network request per card or a DB rewrite.
    const animeSeriesIds = classificationFilters.isAnime === true
      ? items
          .filter((item) => item.type === "series" && item.tmdbId != null)
          .map((item) => Number(item.tmdbId))
      : [];
    const englishAnimeTitles = animeSeriesIds.length > 0
      ? await db.tvMetadataCache.findMany({
          where: { tmdbId: { in: animeSeriesIds } },
          select: { tmdbId: true, title: true },
        })
      : [];
    const englishAnimeTitleById = new Map(englishAnimeTitles.map((item) => [item.tmdbId, item.title]));
    const displayItems = items.map((item) => {
      const englishTitle = item.tmdbId ? englishAnimeTitleById.get(Number(item.tmdbId))?.trim() : null;
      return englishTitle ? { ...item, title: englishTitle } : item;
    });

    // Arabic titles/posters are persisted when a title enters the library.
    // Collection rendering must not issue one localization request per card.
    return NextResponse.json({ items: normalizeMediaMany(displayItems), total, limit, offset });
  } catch (error) {
    console.error("[media:list]", error);
    return NextResponse.json({ error: "Failed to load media library" }, { status: 500 });
  }
}
