import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tmdb, type MediaItem, type PaginatedResponse, type TmdbLanguage } from "@/lib/tmdb";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { getOrCreateUser, parseUserId } from "@/lib/user";

const PAGE_SIZE = 20;
const MAX_TMDB_PAGE = 500;
const FETCH_BATCH_SIZE = 5;

type MediaType = "movie" | "tv";
type ShowMe = "seen" | "unseen";

type Cursor = {
  page: number;
  index: number;
};

function optionalNumber(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCursor(value: string | null): Cursor {
  const match = value?.match(/^(\d+):(\d+)$/);
  if (!match) return { page: 1, index: 0 };

  const page = Math.min(Math.max(Number(match[1]), 1), MAX_TMDB_PAGE);
  const index = Math.min(Math.max(Number(match[2]), 0), PAGE_SIZE);
  return { page, index };
}

function cursorAfter(page: number, index: number, pageLength: number): string {
  return index + 1 < pageLength ? `${page}:${index + 1}` : `${page + 1}:0`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const search = req.nextUrl.searchParams;
    const mediaType: MediaType = search.get("media_type") === "tv" ? "tv" : "movie";
    const showMe: ShowMe = search.get("show_me") === "seen" ? "seen" : "unseen";
    const start = parseCursor(search.get("cursor"));

    const watchedRows = await db.media.findMany({
      where: {
        userId: user.id,
        type: mediaType === "tv" ? "series" : "movie",
        watched: true,
        tmdbId: { not: null },
      },
      select: { tmdbId: true },
    });
    const seenIds = new Set(watchedRows.flatMap((item) => item.tmdbId == null ? [] : [item.tmdbId]));

    if (showMe === "seen" && seenIds.size === 0) {
      return NextResponse.json({ results: [], has_more: false, next_cursor: null });
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
      text_query: search.get("text_query") || undefined,
      language,
    };
    const certification = search.get("certification") || undefined;
    const maxRating = optionalNumber(search.get("max_rating"));
    const excludeArabic = search.get("exclude_arabic") === "true";

    const loadPage = (page: number): Promise<PaginatedResponse<MediaItem>> => mediaType === "tv"
      ? tmdb.discoverTv({ ...common, page })
      : tmdb.discoverMovies({ ...common, certification, page });

    const matchesState = (item: MediaItem) => {
      const isSeen = seenIds.has(Number(item.id));
      return showMe === "seen" ? isSeen : !isSeen;
    };
    const matchesCatalogue = (item: MediaItem) => Boolean(item.poster_path)
      && (!excludeArabic || !isArabicMediaItem(item))
      && (maxRating === undefined || (item.vote_average || 0) <= maxRating);

    const results: MediaItem[] = [];
    let nextCursor: string | null = null;
    let hasMore = false;
    let totalPages = MAX_TMDB_PAGE;
    let sourcePage = start.page;
    let sourceIndex = start.index;

    const consume = (data: PaginatedResponse<MediaItem>) => {
      totalPages = Math.min(data.total_pages || 1, MAX_TMDB_PAGE);
      for (let index = sourceIndex; index < data.results.length; index += 1) {
        const item = data.results[index];
        if (!matchesCatalogue(item) || !matchesState(item)) continue;

        if (results.length < PAGE_SIZE) {
          results.push(item);
          if (results.length === PAGE_SIZE) {
            nextCursor = cursorAfter(data.page, index, data.results.length);
          }
        } else {
          hasMore = true;
          return true;
        }
      }
      return false;
    };

    const firstPage = await loadPage(sourcePage);
    let done = consume(firstPage);
    sourcePage += 1;
    sourceIndex = 0;

    while (!done && sourcePage <= totalPages) {
      const pages = Array.from(
        { length: Math.min(FETCH_BATCH_SIZE, totalPages - sourcePage + 1) },
        (_, index) => sourcePage + index,
      );
      const batch = await Promise.all(pages.map(loadPage));
      for (const data of batch) {
        done = consume(data);
        if (done) break;
      }
      sourcePage += pages.length;
    }

    const response = NextResponse.json({
      results,
      has_more: hasMore,
      next_cursor: hasMore ? nextCursor : null,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("[discover:filtered]", error);
    return NextResponse.json({ error: "Failed to load filtered Discover results" }, { status: 500 });
  }
}
