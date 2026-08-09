import { tmdb, type MediaItem, type PaginatedResponse, type TmdbLanguage } from "@/lib/tmdb";

export const ARABIC_COUNTRY_PRIORITY = [
  "EG",
  "SY",
  "LB",
  "IQ",
  "SA|AE|KW|QA|BH|OM",
  "DZ|KM|DJ|JO|LY|MR|MA|PS|SO|SD|TN|YE",
];

type MovieDiscoverParams = NonNullable<Parameters<typeof tmdb.discoverMovies>[0]>;
type TvDiscoverParams = NonNullable<Parameters<typeof tmdb.discoverTv>[0]>;

export type ArabicPriorityCatalogue = PaginatedResponse<MediaItem> & {
  source_pages_fetched: number;
};

/**
 * Efficient Egypt-first loader for one bounded shelf. It stops as soon as the
 * shelf is full, so a shelf with enough Egyptian films performs one TMDB call
 * instead of querying every Arab country group.
 */
export async function discoverArabicShelfByCountryPriority(
  mediaType: "movie" | "tv",
  baseParams: MovieDiscoverParams | TvDiscoverParams,
  maxItems = 20,
): Promise<MediaItem[]> {
  const limit = Math.max(1, Math.min(Math.floor(maxItems), 100));
  const load = (originCountries: string, page: number) =>
    mediaType === "movie"
      ? tmdb.discoverMovies({ ...(baseParams as MovieDiscoverParams), originCountries, page })
      : tmdb.discoverTv({ ...(baseParams as TvDiscoverParams), originCountries, page });
  const seen = new Set<number>();
  const results: MediaItem[] = [];

  for (const countries of ARABIC_COUNTRY_PRIORITY) {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && results.length < limit) {
      const response = await load(countries, page);
      totalPages = Math.min(response.total_pages || 1, 500);
      for (const item of response.results || []) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        results.push(item);
        if (results.length >= limit) break;
      }
      page += 1;
    }
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Loads one bounded Arabic catalogue with Egyptian titles first without
 * recomputing country totals for every virtual page. This is intended for
 * bounded shelves and release windows, while the paginated helper below
 * remains the source for Discover's stable virtual pagination.
 */
export async function discoverArabicCatalogueByCountryPriority(
  mediaType: "movie" | "tv",
  baseParams: MovieDiscoverParams | TvDiscoverParams,
  maxItems: number,
): Promise<ArabicPriorityCatalogue> {
  const limit = Math.max(1, Math.min(Math.floor(maxItems), 500));
  const load = (originCountries: string, page: number) =>
    mediaType === "movie"
      ? tmdb.discoverMovies({ ...(baseParams as MovieDiscoverParams), originCountries, page })
      : tmdb.discoverTv({ ...(baseParams as TvDiscoverParams), originCountries, page });

  const firstPages = await Promise.all(
    ARABIC_COUNTRY_PRIORITY.map((countries) => load(countries, 1)),
  );
  const totalResults = firstPages.reduce((sum, response) => sum + (response.total_results || 0), 0);
  const seen = new Set<number>();
  const results: MediaItem[] = [];
  let sourcePagesFetched = firstPages.length;

  const append = (items: MediaItem[]) => {
    for (const item of items) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      results.push(item);
      if (results.length >= limit) break;
    }
  };

  for (let groupIndex = 0; groupIndex < firstPages.length && results.length < limit; groupIndex += 1) {
    const first = firstPages[groupIndex];
    append(first.results || []);
    const groupPages = Math.min(first.total_pages || 1, 500);
    for (let page = 2; page <= groupPages && results.length < limit; page += 1) {
      const response = await load(ARABIC_COUNTRY_PRIORITY[groupIndex], page);
      sourcePagesFetched += 1;
      append(response.results || []);
    }
  }

  return {
    page: 1,
    results,
    total_pages: Math.min(500, Math.ceil(totalResults / 20)),
    total_results: totalResults,
    source_pages_fetched: sourcePagesFetched,
  };
}

export async function discoverArabicByCountryPriority(
  mediaType: "movie" | "tv",
  baseParams: MovieDiscoverParams | TvDiscoverParams,
  requestedPage: number,
): Promise<PaginatedResponse<MediaItem>> {
  const load = (originCountries: string, page: number, language: TmdbLanguage) =>
    mediaType === "movie"
      ? tmdb.discoverMovies({ ...(baseParams as MovieDiscoverParams), originCountries, page, language })
      : tmdb.discoverTv({ ...(baseParams as TvDiscoverParams), originCountries, page, language });

  const groupCounts = await Promise.all(
    ARABIC_COUNTRY_PRIORITY.map(async (countries) => {
      const response = await load(countries, 1, "en-US");
      return response.total_results || 0;
    }),
  );
  const totalResults = groupCounts.reduce((sum, count) => sum + count, 0);
  const pageSize = 20;
  let offset = (Math.max(1, requestedPage) - 1) * pageSize;
  let remaining = pageSize;
  const results: MediaItem[] = [];

  for (let groupIndex = 0; groupIndex < ARABIC_COUNTRY_PRIORITY.length && remaining > 0; groupIndex += 1) {
    const groupCount = groupCounts[groupIndex];
    if (offset >= groupCount) {
      offset -= groupCount;
      continue;
    }

    while (offset < groupCount && remaining > 0) {
      const localPage = Math.floor(offset / pageSize) + 1;
      const localIndex = offset % pageSize;
      const response = await load(ARABIC_COUNTRY_PRIORITY[groupIndex], localPage, baseParams.language);
      const available = response.results.slice(localIndex, localIndex + remaining);
      results.push(...available);
      remaining -= available.length;
      offset += available.length;
      if (available.length === 0) break;
    }
    offset = 0;
  }

  return {
    page: requestedPage,
    results,
    total_pages: Math.min(500, Math.ceil(totalResults / pageSize)),
    total_results: totalResults,
  };
}
