import { ASIAN_COUNTRY_CODES } from "@/lib/asian-media";
import { filterAndPrioritizeMediaCollectionWorldItems } from "@/lib/media-world-pipeline";
import { tmdb, type MediaItem, type PaginatedResponse } from "@/lib/tmdb";

const PAGE_SIZE = 20;

export async function discoverAsianMoviesByPriority(
  params: NonNullable<Parameters<typeof tmdb.discoverMovies>[0]>,
  page: number,
): Promise<PaginatedResponse<MediaItem>> {
  const response = await tmdb.discoverMovies({
    ...params,
    page,
    originCountries: ASIAN_COUNTRY_CODES.join("|"),
  });
  return {
    ...response,
    results: filterAndPrioritizeMediaCollectionWorldItems(response.results, "asian-movies"),
  };
}

export async function discoverAsianTvByPriority(
  params: NonNullable<Parameters<typeof tmdb.discoverTv>[0]>,
  page: number,
): Promise<PaginatedResponse<MediaItem>> {
  const withoutGenres = [...new Set([...(params.without_genres ?? []), 16])];
  const sourcePage = Math.max(1, (page - 1) * 2 + 1);
  const base = { ...params, originCountries: undefined, without_genres: withoutGenres };
  const fetchPool = async (originCountries?: string) => {
    const [first, second] = await Promise.all([
      tmdb.discoverTv({ ...base, page: sourcePage, originCountries }),
      tmdb.discoverTv({ ...base, page: sourcePage + 1, originCountries }),
    ]);
    return {
      results: [...first.results, ...second.results],
      total_pages: Math.max(first.total_pages, second.total_pages),
      total_results: Math.max(first.total_results, second.total_results),
    };
  };
  const [korean, japanese, chinese, worldwide] = await Promise.all([
    fetchPool("KR"),
    fetchPool("JP"),
    fetchPool("CN"),
    fetchPool(),
  ]);

  const candidates = filterAndPrioritizeMediaCollectionWorldItems([
    ...korean.results,
    ...japanese.results,
    ...chinese.results,
    ...worldwide.results,
  ], "asian-tv");
  const selected: MediaItem[] = [];
  const seen = new Set<number>();
  for (const item of candidates) {
    const id = Number(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(item);
    if (selected.length >= PAGE_SIZE) break;
  }

  return {
    page,
    results: selected,
    total_pages: Math.ceil(Math.max(korean.total_pages, japanese.total_pages, chinese.total_pages, worldwide.total_pages) / 2),
    total_results: korean.total_results + japanese.total_results + chinese.total_results + worldwide.total_results,
  };
}
