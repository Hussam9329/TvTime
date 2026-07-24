import { tmdb, type MediaItem, type PaginatedResponse, type TmdbLanguage } from "@/lib/tmdb";

const ARABIC_COUNTRY_PRIORITY = [
  "EG",
  "SY",
  "LB",
  "IQ",
  "SA|AE|KW|QA|BH|OM",
  "DZ|KM|DJ|JO|LY|MR|MA|PS|SO|SD|TN|YE",
];

type MovieDiscoverParams = NonNullable<Parameters<typeof tmdb.discoverMovies>[0]>;
type TvDiscoverParams = NonNullable<Parameters<typeof tmdb.discoverTv>[0]>;

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
