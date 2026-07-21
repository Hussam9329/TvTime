export const DISCOVER_PAGE_SIZE = 20;
export const DISCOVER_TMDB_MAX_PAGE = 500;
export const DISCOVER_TMDB_PAGE_BUDGET = 8;
export const DISCOVER_FETCH_BATCH_SIZE = 3;

export type DiscoverCursor = {
  page: number;
  index: number;
};

export function parseDiscoverCursor(value: string | null): DiscoverCursor {
  const match = value?.match(/^(\d+):(\d+)$/);
  if (!match) return { page: 1, index: 0 };

  const page = Math.min(Math.max(Number(match[1]), 1), DISCOVER_TMDB_MAX_PAGE);
  const index = Math.min(Math.max(Number(match[2]), 0), DISCOVER_PAGE_SIZE);
  return { page, index };
}

export function discoverCursorAfter(page: number, index: number, pageLength: number): string {
  return index + 1 < pageLength ? `${page}:${index + 1}` : `${page + 1}:0`;
}

/**
 * Return only the next TMDB pages that fit inside this request's remaining
 * budget. Repeated calls can never produce more than
 * DISCOVER_TMDB_PAGE_BUDGET pages for one HTTP response.
 */
export function nextDiscoverPageBatch(options: {
  nextPage: number;
  totalPages: number;
  pagesFetched: number;
}): number[] {
  const nextPage = Math.max(1, Math.floor(options.nextPage));
  const totalPages = Math.min(
    DISCOVER_TMDB_MAX_PAGE,
    Math.max(0, Math.floor(options.totalPages)),
  );
  const pagesFetched = Math.max(0, Math.floor(options.pagesFetched));
  const remainingBudget = Math.max(0, DISCOVER_TMDB_PAGE_BUDGET - pagesFetched);
  if (remainingBudget === 0 || nextPage > totalPages) return [];

  const batchSize = Math.min(
    DISCOVER_FETCH_BATCH_SIZE,
    remainingBudget,
    totalPages - nextPage + 1,
  );
  return Array.from({ length: batchSize }, (_, index) => nextPage + index);
}
