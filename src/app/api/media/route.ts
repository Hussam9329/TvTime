import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { normalizeMediaMany } from "@/lib/media-normalize";
import type { Prisma } from "@prisma/client";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import {
  recordMatchesMediaClassification,
  type MediaCollectionWorld,
  type MediaClassificationFilters,
} from "@/lib/media-world-classification";
import {
  matchesMediaCollectionWorld,
  prioritizeMediaCollectionWorldItems,
} from "@/lib/media-world-pipeline";

const SORTABLE_FIELDS = new Set(["addedAt", "updatedAt", "userRating", "title", "year", "watchedAt"]);
const ORDERS = new Set(["asc", "desc"]);
const COLLECTION_WORLDS = new Set<MediaCollectionWorld>([
  "movies", "asian-movies", "anime", "arabic-movies",
  "standard-tv", "arabic-tv", "asian-tv",
]);

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
    const collectionWorldParam = url.searchParams.get("collectionWorld") as MediaCollectionWorld | null;
    const collectionWorld = collectionWorldParam && COLLECTION_WORLDS.has(collectionWorldParam)
      ? collectionWorldParam
      : null;

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

    const parseFiniteNumber = (key: string) => {
      const raw = url.searchParams.get(key);
      if (raw == null || raw.trim() === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const yearFrom = parseFiniteNumber("yearFrom");
    const yearTo = parseFiniteNumber("yearTo");
    const ratingFrom = parseFiniteNumber("ratingFrom");
    const ratingTo = parseFiniteNumber("ratingTo");

    if (yearFrom != null || yearTo != null) {
      where.year = {
        ...(yearFrom != null ? { gte: String(Math.trunc(yearFrom)).padStart(4, "0") } : {}),
        ...(yearTo != null ? { lte: String(Math.trunc(yearTo)).padStart(4, "0") } : {}),
      };
    }
    // rating is a String column holding the TMDB score ("0.0"–"10.0").
    // Numeric range filtering on a string column isn't reliable across
    // Postgres collations, so we filter in-memory after classification.
    // Bounds are clamped to [0, 10] regardless of what the client sends.
    const clampRating = (value: number) => Math.max(0, Math.min(10, value));
    const tmdbRatingFrom = ratingFrom != null ? clampRating(ratingFrom) : null;
    const tmdbRatingTo = ratingTo != null ? clampRating(ratingTo) : null;

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
    const matchingItems = classifiedCandidates.filter((item) => collectionWorld
      ? matchesMediaCollectionWorld(item, collectionWorld)
      : recordMatchesMediaClassification(item, classificationFilters));
    // Apply the same stable world priority before pagination that Overview,
    // Discover and Releases use. Legacy boolean-only callers retain their
    // existing behavior until they identify an exact collection world.
    const prioritizedItems = collectionWorld
      ? prioritizeMediaCollectionWorldItems(matchingItems, collectionWorld)
      : classificationFilters.isArabic === true
        ? prioritizeMediaCollectionWorldItems(
            matchingItems,
            type === "series" || type === "tv" ? "arabic-tv" : "arabic-movies",
          )
        : matchingItems;
    const filteredByRating = (tmdbRatingFrom != null || tmdbRatingTo != null)
      ? prioritizedItems.filter((item) => {
          if (item.rating == null || item.rating.trim() === "") return false;
          const score = Number(item.rating);
          if (!Number.isFinite(score)) return false;
          if (tmdbRatingFrom != null && score < tmdbRatingFrom) return false;
          if (tmdbRatingTo != null && score > tmdbRatingTo) return false;
          return true;
        })
      : prioritizedItems;
    const total = filteredByRating.length;
    const items = filteredByRating.slice(offset, offset + limit);

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
