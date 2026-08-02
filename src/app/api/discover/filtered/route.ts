import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTmdbKeywordIds, tmdb, type MediaItem, type PaginatedResponse, type TmdbLanguage } from "@/lib/tmdb";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { resolveUserId } from "@/lib/auth";
import { buildSeenIdSet } from "@/lib/discover-seen";
import { discoverArabicByCountryPriority } from "@/lib/arabic-discover";
import { ASIAN_ORIGIN_COUNTRY_QUERY } from "@/lib/asian-media";
import { discoverAsianTvByPriority } from "@/lib/asian-discover-server";
import { enrichMovieOriginCountries } from "@/lib/movie-origin-server";
import { sortByStandardMediaPriority } from "@/lib/standard-media-priority";
import { matchesDiscoverWorld, type DiscoverWorld } from "@/lib/discover-world";
import {
  DISCOVER_PAGE_SIZE,
  DISCOVER_TMDB_MAX_PAGE,
  DISCOVER_TMDB_PAGE_BUDGET,
  discoverCursorAfter,
  nextDiscoverPageBatch,
  parseDiscoverCursor,
} from "@/lib/discover-budget";

type MediaType = "movie" | "tv";
type ShowMe = "all" | "seen" | "unseen";
type TvFormat = "all" | "miniseries" | "anthology";

function optionalNumber(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams;
    const mediaType: MediaType = search.get("media_type") === "tv" ? "tv" : "movie";
    const showMeValue = search.get("show_me");
    const showMe: ShowMe = showMeValue === "all" ? "all" : showMeValue === "seen" ? "seen" : "unseen";
    const requestedWorld = search.get("world");
    const world: DiscoverWorld = requestedWorld === "arabic" || requestedWorld === "asian" || requestedWorld === "anime"
      ? requestedWorld
      : "standard";
    const requestedTvFormat = search.get("tv_format");
    const tvFormat: TvFormat = mediaType === "tv" && (requestedTvFormat === "miniseries" || requestedTvFormat === "anthology")
      ? requestedTvFormat
      : "all";
    const start = parseDiscoverCursor(search.get("cursor"));

    let seenIds = new Set<number>();
    if (showMe !== "all") {
      // Personal filters resolve the signed request owner without creating a
      // User or running legacy migrations inside this read-only GET.
      const userId = await resolveUserId(req);
      const [mediaRows, legacyRows] = await Promise.all([
        db.media.findMany({
          where: {
            userId,
            type: mediaType === "tv" ? "series" : "movie",
            tmdbId: { not: null },
            ...(mediaType === "tv"
              ? { OR: [{ watched: true }, { status: { in: ["watching", "uptodate", "up_to_date", "finished", "watched"] } }] }
              : { watched: true }),
          },
          select: { tmdbId: true, watched: true, status: true },
        }),
        mediaType === "tv"
          ? db.watchedEpisode.findMany({ where: { userId }, distinct: ["showId"], select: { showId: true } })
          : db.watchedMovie.findMany({ where: { userId }, select: { tmdbId: true } }),
      ]);
      const legacyIds = mediaType === "tv"
        ? legacyRows.map((row) => "showId" in row ? row.showId : 0)
        : legacyRows.map((row) => "tmdbId" in row ? row.tmdbId : 0);
      seenIds = buildSeenIdSet(mediaType, mediaRows, legacyIds);
    }

    if (showMe === "seen" && seenIds.size === 0) {
      return NextResponse.json({
        results: [],
        has_more: false,
        next_cursor: null,
        scan: { pages_fetched: 0, page_budget: DISCOVER_TMDB_PAGE_BUDGET, budget_exhausted: false },
      });
    }

    const genres = search.get("genre")?.split(",").map(Number).filter(Boolean);
    const language = (search.get("language") || undefined) as TmdbLanguage;
    const common = {
      genres: genres?.length ? genres : undefined,
      sort_by: search.get("sort_by") || undefined,
      vote_average_gte: optionalNumber(search.get("rating")),
      vote_average_lte: optionalNumber(search.get("max_rating")),
      original_language: search.get("original_language") || undefined,
      originCountries: search.get("origin_country") || undefined,
      vote_count_gte: optionalNumber(search.get("vote_count")),
      release_date_gte: search.get("release_date_gte") || undefined,
      release_date_lte: search.get("release_date_lte") || undefined,
      runtime_gte: optionalNumber(search.get("runtime_gte")),
      runtime_lte: optionalNumber(search.get("runtime_lte")),
      series_type: tvFormat === "miniseries" ? 2 : undefined,
      language,
    };
    const keywordQuery = search.get("keyword_query")?.trim();
    const [keywordIds, anthologyKeywordIds] = await Promise.all([
      keywordQuery ? resolveTmdbKeywordIds(keywordQuery, language) : Promise.resolve(undefined),
      tvFormat === "anthology" ? resolveTmdbKeywordIds("anthology", "en-US") : Promise.resolve(undefined),
    ]);
    if (keywordQuery && keywordIds?.length === 0) {
      return NextResponse.json({
        results: [],
        has_more: false,
        next_cursor: null,
        scan: { pages_fetched: 0, page_budget: DISCOVER_TMDB_PAGE_BUDGET, budget_exhausted: false },
      });
    }
    if (tvFormat === "anthology" && anthologyKeywordIds?.length === 0) {
      return NextResponse.json({
        results: [],
        has_more: false,
        next_cursor: null,
        scan: { pages_fetched: 0, page_budget: DISCOVER_TMDB_PAGE_BUDGET, budget_exhausted: false },
      });
    }
    const keywordGroups = [keywordIds, anthologyKeywordIds].filter((group): group is number[] => Boolean(group?.length));

    const certification = search.get("certification") || undefined;
    const excludeArabic = search.get("exclude_arabic") === "true";
    const onlyArabic = search.get("only_arabic") === "true";

    const loadPage = (page: number): Promise<PaginatedResponse<MediaItem>> => {
      if (onlyArabic) {
        const params = mediaType === "tv"
          ? { ...common, keyword_groups: keywordGroups }
          : { ...common, keyword_groups: keywordGroups, certification };
        return discoverArabicByCountryPriority(mediaType, params, page);
      }
      if (mediaType === "tv" && common.originCountries === ASIAN_ORIGIN_COUNTRY_QUERY) {
        return discoverAsianTvByPriority({ ...common, keyword_groups: keywordGroups }, page);
      }
      return mediaType === "tv"
        ? tmdb.discoverTv({ ...common, keyword_groups: keywordGroups, page })
        : tmdb.discoverMovies({ ...common, keyword_groups: keywordGroups, certification, page });
    };

    const matchesState = (item: MediaItem) => {
      if (showMe === "all") return true;
      const isSeen = seenIds.has(Number(item.id));
      return showMe === "seen" ? isSeen : !isSeen;
    };
    const matchesCatalogue = (item: MediaItem) => {
      const isArabic = isArabicMediaItem(item);
      if ((excludeArabic && isArabic) || (onlyArabic && !isArabic)) return false;
      return matchesDiscoverWorld(item, mediaType, world);
    };

    const results: MediaItem[] = [];
    let nextCursor: string | null = null;
    let hasMore = false;
    let totalPages = DISCOVER_TMDB_MAX_PAGE;
    let nextPage = start.page;
    let firstPageIndex = start.index;
    let pagesFetched = 0;
    let pageSizeObserved = DISCOVER_PAGE_SIZE;

    const consume = (data: PaginatedResponse<MediaItem>, startIndex: number) => {
      totalPages = Math.min(data.total_pages || 1, DISCOVER_TMDB_MAX_PAGE);
      pageSizeObserved = Math.max(1, data.results.length || DISCOVER_PAGE_SIZE);
      for (let index = startIndex; index < data.results.length; index += 1) {
        const item = data.results[index];
        if (!matchesCatalogue(item) || !matchesState(item)) continue;

        results.push(item);
        if (results.length === DISCOVER_PAGE_SIZE) {
          nextCursor = discoverCursorAfter(data.page, index, data.results.length);
          hasMore = index + 1 < data.results.length || data.page < totalPages;
          return true;
        }
      }
      return false;
    };

    let done = false;
    while (!done && nextPage <= totalPages && pagesFetched < DISCOVER_TMDB_PAGE_BUDGET) {
      const pages = nextDiscoverPageBatch({ nextPage, totalPages, pagesFetched });
      if (pages.length === 0) break;
      const batch = await Promise.all(pages.map(loadPage));
      pagesFetched += pages.length;

      for (let index = 0; index < batch.length; index += 1) {
        const data = batch[index];
        done = consume(data, index === 0 ? firstPageIndex : 0);
        nextPage = data.page + 1;
        firstPageIndex = 0;
        if (done) break;
      }
    }

    const budgetExhausted = !done && nextPage <= totalPages && pagesFetched >= DISCOVER_TMDB_PAGE_BUDGET;
    if (budgetExhausted) {
      hasMore = true;
      nextCursor = `${nextPage}:0`;
    } else if (!done) {
      hasMore = false;
      nextCursor = null;
    }

    // Defensive cursor cap if TMDB returned an unusual empty page size.
    if (nextCursor) {
      const parsed = parseDiscoverCursor(nextCursor);
      nextCursor = `${parsed.page}:${Math.min(parsed.index, pageSizeObserved)}`;
    }

    const prioritizedResults = mediaType === "movie" && !onlyArabic
      ? sortByStandardMediaPriority(await enrichMovieOriginCountries(results, language))
      : results;

    const response = NextResponse.json({
      results: prioritizedResults,
      has_more: hasMore,
      next_cursor: hasMore ? nextCursor : null,
      partial: budgetExhausted,
      scan: {
        pages_fetched: pagesFetched,
        page_budget: DISCOVER_TMDB_PAGE_BUDGET,
        budget_exhausted: budgetExhausted,
      },
    });
    response.headers.set(
      "Cache-Control",
      showMe === "all"
        ? "public, max-age=60, s-maxage=300, stale-while-revalidate=900"
        : "private, no-store",
    );
    response.headers.set("X-TvTime-TMDB-Pages", String(pagesFetched));
    response.headers.set("X-TvTime-TMDB-Page-Budget", String(DISCOVER_TMDB_PAGE_BUDGET));
    return response;
  } catch (error) {
    console.error("[discover:filtered]", error);
    return NextResponse.json({ error: "Failed to load filtered Discover results" }, { status: 500 });
  }
}
