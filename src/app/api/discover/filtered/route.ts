import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveTmdbKeywordIds, tmdb, type MediaItem, type PaginatedResponse, type TmdbLanguage } from "@/lib/tmdb";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { resolveUserId } from "@/lib/auth";
import { buildSeenIdSet } from "@/lib/discover-seen";
import {
  DISCOVER_PAGE_SIZE,
  DISCOVER_TMDB_MAX_PAGE,
  DISCOVER_TMDB_PAGE_BUDGET,
  discoverCursorAfter,
  nextDiscoverPageBatch,
  parseDiscoverCursor,
} from "@/lib/discover-budget";

type MediaType = "movie" | "tv";
type ShowMe = "seen" | "unseen";

function optionalNumber(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: NextRequest) {
  try {
    // Read-only route: resolving the signed request owner is enough. Creating a
    // User or running legacy migrations during catalogue browsing would turn a
    // retryable GET into a write operation.
    const userId = await resolveUserId(req);
    const search = req.nextUrl.searchParams;
    const mediaType: MediaType = search.get("media_type") === "tv" ? "tv" : "movie";
    const showMe: ShowMe = search.get("show_me") === "seen" ? "seen" : "unseen";
    const start = parseDiscoverCursor(search.get("cursor"));

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
    const seenIds = buildSeenIdSet(mediaType, mediaRows, legacyIds);

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
      original_language: search.get("original_language") || undefined,
      vote_count_gte: optionalNumber(search.get("vote_count")),
      release_date_gte: search.get("release_date_gte") || undefined,
      release_date_lte: search.get("release_date_lte") || undefined,
      runtime_gte: optionalNumber(search.get("runtime_gte")),
      runtime_lte: optionalNumber(search.get("runtime_lte")),
      language,
    };
    const keywordQuery = search.get("keyword_query")?.trim();
    const keywordIds = keywordQuery ? await resolveTmdbKeywordIds(keywordQuery, language) : undefined;
    if (keywordQuery && keywordIds?.length === 0) {
      return NextResponse.json({
        results: [],
        has_more: false,
        next_cursor: null,
        scan: { pages_fetched: 0, page_budget: DISCOVER_TMDB_PAGE_BUDGET, budget_exhausted: false },
      });
    }

    const certification = search.get("certification") || undefined;
    const maxRating = optionalNumber(search.get("max_rating"));
    const excludeArabic = search.get("exclude_arabic") === "true";
    const onlyArabic = search.get("only_arabic") === "true";

    const loadPage = (page: number): Promise<PaginatedResponse<MediaItem>> => mediaType === "tv"
      ? tmdb.discoverTv({ ...common, keyword_ids: keywordIds, page })
      : tmdb.discoverMovies({ ...common, keyword_ids: keywordIds, certification, page });

    const matchesState = (item: MediaItem) => {
      const isSeen = seenIds.has(Number(item.id));
      return showMe === "seen" ? isSeen : !isSeen;
    };
    const matchesCatalogue = (item: MediaItem) => Boolean(item.poster_path)
      && (!excludeArabic || !isArabicMediaItem(item))
      && (!onlyArabic || isArabicMediaItem(item))
      && (maxRating === undefined || (item.vote_average || 0) <= maxRating);

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

    const response = NextResponse.json({
      results,
      has_more: hasMore,
      next_cursor: hasMore ? nextCursor : null,
      partial: budgetExhausted,
      scan: {
        pages_fetched: pagesFetched,
        page_budget: DISCOVER_TMDB_PAGE_BUDGET,
        budget_exhausted: budgetExhausted,
      },
    });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-TvTime-TMDB-Pages", String(pagesFetched));
    response.headers.set("X-TvTime-TMDB-Page-Budget", String(DISCOVER_TMDB_PAGE_BUDGET));
    return response;
  } catch (error) {
    console.error("[discover:filtered]", error);
    return NextResponse.json({ error: "Failed to load filtered Discover results" }, { status: 500 });
  }
}
