import { isAsianMediaItem } from "@/lib/asian-media";
import { tmdb, type MediaItem, type PaginatedResponse } from "@/lib/tmdb";

const PRIORITY_COUNTRIES = ["KR", "JP", "CN"] as const;
const PAGE_SIZE = 20;

export async function discoverAsianTvByPriority(
  params: NonNullable<Parameters<typeof tmdb.discoverTv>[0]>,
  page: number,
): Promise<PaginatedResponse<MediaItem>> {
  const withoutGenres = [...new Set([...(params.without_genres ?? []), 16])];
  const base = { ...params, page, originCountries: undefined, without_genres: withoutGenres, vote_count_gte: params.vote_count_gte ?? 0 };
  const [korean, japanese, chinese, worldwide] = await Promise.all([
    tmdb.discoverTv({ ...base, originCountries: "KR" }),
    tmdb.discoverTv({ ...base, originCountries: "JP" }),
    tmdb.discoverTv({ ...base, originCountries: "CN" }),
    tmdb.discoverTv(base),
  ]);

  const otherAsian = worldwide.results.filter((item) => {
    const countries = item.origin_country ?? [];
    return isAsianMediaItem(item) && !countries.some((country) => PRIORITY_COUNTRIES.includes(country as typeof PRIORITY_COUNTRIES[number]));
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
    total_pages: Math.max(korean.total_pages, japanese.total_pages, chinese.total_pages, worldwide.total_pages),
    total_results: korean.total_results + japanese.total_results + chinese.total_results + otherAsian.length,
  };
}
