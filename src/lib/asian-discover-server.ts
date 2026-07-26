import { isAsianMediaItem } from "@/lib/asian-media";
import { isAnimeMediaItem } from "@/lib/anime-detect";
import { isArabicMediaItem } from "@/lib/arabic-media";
import { tmdb, type MediaItem, type PaginatedResponse } from "@/lib/tmdb";

const PRIORITY_COUNTRIES = ["KR", "JP", "CN"] as const;
const PAGE_SIZE = 20;

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

  const eligible = (item: MediaItem) => isAsianMediaItem(item)
    && !isAnimeMediaItem(item)
    && !isArabicMediaItem(item);
  korean.results = korean.results.filter(eligible);
  japanese.results = japanese.results.filter(eligible);
  chinese.results = chinese.results.filter(eligible);

  const otherAsian = worldwide.results.filter((item) => {
    const countries = item.origin_country ?? [];
    return eligible(item) && !countries.some((country) => PRIORITY_COUNTRIES.includes(country as typeof PRIORITY_COUNTRIES[number]));
  });
  const pools = [korean.results, japanese.results, chinese.results, otherAsian];
  const quotas = [8, 5, 4, 3];
  const selected: MediaItem[] = [];
  const seen = new Set<number>();
  const append = (items: MediaItem[], limit = Infinity) => {
    for (const item of items) {
      if (selected.length >= PAGE_SIZE || limit <= 0) break;
      const id = Number(item.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      selected.push(item);
      limit -= 1;
    }
  };
  pools.forEach((pool, index) => append(pool, quotas[index]));
  pools.forEach((pool) => append(pool));

  return {
    page,
    results: selected,
    total_pages: Math.ceil(Math.max(korean.total_pages, japanese.total_pages, chinese.total_pages, worldwide.total_pages) / 2),
    total_results: korean.total_results + japanese.total_results + chinese.total_results + worldwide.total_results,
  };
}
