import { tmdb, type MediaItem, type TmdbLanguage } from "@/lib/tmdb";

const MINI_SERIES_DETAIL_CONCURRENCY = 5;

export function isStrictMiniSeries(detail: { number_of_seasons?: number | null }): boolean {
  return Number(detail.number_of_seasons) === 1;
}

/**
 * TMDB's Discover `with_type=2` catalogue occasionally includes shows that
 * later grew into multiple seasons. Verify the current season count from the
 * lightweight TV summary endpoint and fail closed when that check is missing.
 */
export async function filterStrictMiniSeriesResults(
  items: MediaItem[],
  language?: TmdbLanguage,
): Promise<MediaItem[]> {
  const accepted = new Set<number>();

  for (let index = 0; index < items.length; index += MINI_SERIES_DETAIL_CONCURRENCY) {
    const chunk = items.slice(index, index + MINI_SERIES_DETAIL_CONCURRENCY);
    const checks = await Promise.all(chunk.map(async (item) => {
      const id = Number(item.id);
      if (!Number.isInteger(id) || id <= 0) return null;
      try {
        const detail = await tmdb.tvSummary(id, language);
        return isStrictMiniSeries(detail) ? id : null;
      } catch {
        return null;
      }
    }));
    checks.forEach((id) => { if (id != null) accepted.add(id); });
  }

  return items.filter((item) => accepted.has(Number(item.id)));
}
