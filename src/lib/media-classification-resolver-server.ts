import { classifyMediaWorld, type GeneralMediaClassificationInput } from "@/lib/media-world-classification";
import {
  batchReadDbClassifications,
  getTvStatusMetadata,
  type TvClassificationMetadata,
} from "@/lib/tv-status-server";

type MediaRecord = GeneralMediaClassificationInput & {
  tmdbId?: number | null;
  genres?: string[] | null;
};

const CLASSIFICATION_FETCH_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

/**
 * Resolve one canonical classification for every Media record.
 *
 * Complete TvMetadataCache rows are authoritative even when the episode/status
 * cache is stale. Missing TV classifications are fetched from TMDB once and
 * cached. Movie and non-TMDB rows still pass through the same pure classifier
 * using the best metadata stored on the record.
 */
export async function resolveGeneralMediaClassifications<T extends MediaRecord>(
  items: T[],
  options: { allowNetwork?: boolean } = {},
): Promise<T[]> {
  if (items.length === 0) return [];

  const tvIds = [...new Set(items
    .filter((item) => item.type === "series" || item.type === "tv")
    .map((item) => Number(item.tmdbId))
    .filter((id) => Number.isInteger(id) && id > 0))];
  const classifications = await batchReadDbClassifications(tvIds);
  const missingIds = tvIds.filter((id) => !classifications.has(id));

  if (options.allowNetwork !== false) {
    await mapWithConcurrency(missingIds, CLASSIFICATION_FETCH_CONCURRENCY, async (tmdbId) => {
      try {
        const metadata = await getTvStatusMetadata(tmdbId, new Date(), {
          requireClassification: true,
        });
        classifications.set(tmdbId, {
          originalLanguage: metadata.originalLanguage,
          originCountries: metadata.originCountries,
          genres: metadata.genres.map((genre) => genre.name),
          classificationComplete: true,
        });
      } catch (error) {
        console.warn("[media-classification] Unable to resolve TMDB metadata", tmdbId, error);
      }
    });
  }

  return items.map((item) => {
    const tmdbId = Number(item.tmdbId);
    const authoritative: TvClassificationMetadata | undefined =
      Number.isInteger(tmdbId) && tmdbId > 0 ? classifications.get(tmdbId) : undefined;
    const merged = authoritative ? { ...item, ...authoritative } : item;
    const classification = classifyMediaWorld(merged);

    return {
      ...merged,
      isAnime: classification.isAnime,
      isArabic: classification.isArabic,
    };
  });
}
