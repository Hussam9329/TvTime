import { tmdb, type Episode, type SeasonDetail, type TvDetail } from "@/lib/tmdb";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  episodeKey,
  inferAiredEpisodesFromTvDetail,
  isEpisodeReleased,
  isFutureEpisode,
  isOfficiallyEndedTvStatus,
} from "@/lib/tv-status-engine";

const ENDED_TV_META_TTL_MS = 6 * 60 * 60 * 1000;
const ONGOING_TV_META_TTL_MS = 5 * 60 * 1000;
const SEASON_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { value: T; fetchedAt: number };

export type TvStatusMetadata = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  overview: string | null;
  firstAirDate: string | null;
  originalLanguage: string | null;
  originCountries: string[];
  genres: Array<{ id: number; name: string }>;
  classificationComplete: boolean;
  tmdbStatus: string | null;
  officiallyEnded: boolean;
  inProduction: boolean | null;
  totalEpisodes: number | null;
  totalSeasons: number | null;
  airedEpisodeCount: number | null;
  airedEpisodeKeys: Set<string>;
  airedEpisodeInferenceReliable: boolean;
  nextEpisode: {
    airDate: string;
    name: string | null;
    seasonNumber: number;
    episodeNumber: number;
  } | null;
  detail: TvDetail;
};

export type ReleasedEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  runtime: number | null;
  airDate: string | null;
};

// In-memory caches remain as a fast L1 layer for hot reads within a single
// serverless invocation. The DB cache (TvMetadataCache) is the L2 layer
// that survives cold starts.
const tvMetadataCache = new Map<number, CacheEntry<TvStatusMetadata>>();
const seasonCache = new Map<string, CacheEntry<SeasonDetail>>();

function readFresh<T>(entry: CacheEntry<T> | undefined, ttl: number): T | null {
  if (!entry) return null;
  return Date.now() - entry.fetchedAt < ttl ? entry.value : null;
}

function readFreshTvMetadata(
  entry: CacheEntry<TvStatusMetadata> | undefined,
  now: Date,
  requireClassification = false,
): TvStatusMetadata | null {
  if (!entry) return null;
  const ttl = entry.value.officiallyEnded ? ENDED_TV_META_TTL_MS : ONGOING_TV_META_TTL_MS;
  const cached = readFresh(entry, ttl);
  if (!cached) return null;
  if (requireClassification && !cached.classificationComplete) return null;

  // Do not let the ordinary metadata TTL hide an episode whose calendar date
  // has just arrived. TMDB only supplies an air date here, so the state engine
  // must refresh the boundary as soon as that date becomes current.
  if (cached.nextEpisode?.airDate && isEpisodeReleased(cached.nextEpisode.airDate, now)) {
    return null;
  }
  return cached;
}

/**
 * Deserialize a TvMetadataCache row from DB into the runtime TvStatusMetadata
 * shape. The DB stores airedEpisodeKeys as TEXT[] for compactness — we
 * rehydrate them into a Set for O(1) lookups. The `detail` field is
 * reconstructed minimally because tv-status-engine only needs a handful of
 * fields; we keep it loose (any) to avoid over-specifying.
 */
type TvMetadataDbRow = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  overview: string | null;
  firstAirDate: string | null;
  originalLanguage: string | null;
  originCountries: string[];
  genreIds: number[];
  genreNames: string[];
  classificationComplete: boolean;
  tmdbStatus: string | null;
  officiallyEnded: boolean;
  inProduction: boolean | null;
  totalEpisodes: number | null;
  totalSeasons: number | null;
  airedEpisodeCount: number | null;
  airedEpisodeKeys: string[];
  airedEpisodeInferenceReliable: boolean;
  nextEpisodeAirDate: string | null;
  nextEpisodeName: string | null;
  nextEpisodeSeasonNumber: number | null;
  nextEpisodeEpisodeNumber: number | null;
  seasonsCount: number | null;
  lastSeasonNumber: number | null;
  refreshAfter: Date;
};

function metadataFromDbRow(row: TvMetadataDbRow): TvStatusMetadata {
  const hasNext =
    row.nextEpisodeAirDate !== null &&
    row.nextEpisodeSeasonNumber !== null &&
    row.nextEpisodeEpisodeNumber !== null;
  const genres = (row.genreNames ?? [])
    .map((name, index) => ({ id: Number(row.genreIds?.[index] ?? 0), name: String(name || "").trim() }))
    .filter((genre) => genre.name.length > 0);
  return {
    tmdbId: row.tmdbId,
    title: row.title,
    posterPath: row.posterPath,
    overview: row.overview,
    firstAirDate: row.firstAirDate,
    originalLanguage: row.originalLanguage,
    originCountries: row.originCountries ?? [],
    genres,
    classificationComplete: row.classificationComplete,
    tmdbStatus: row.tmdbStatus,
    officiallyEnded: row.officiallyEnded,
    inProduction: row.inProduction,
    totalEpisodes: row.totalEpisodes,
    totalSeasons: row.totalSeasons,
    airedEpisodeCount: row.airedEpisodeCount,
    airedEpisodeKeys: new Set(row.airedEpisodeKeys ?? []),
    airedEpisodeInferenceReliable: row.airedEpisodeInferenceReliable,
    nextEpisode: hasNext
      ? {
          airDate: row.nextEpisodeAirDate!,
          name: row.nextEpisodeName,
          seasonNumber: row.nextEpisodeSeasonNumber!,
          episodeNumber: row.nextEpisodeEpisodeNumber!,
        }
      : null,
    // Minimal detail stub — the runtime engine only reads .seasons and
    // .next_episode_to_air from this object when using the cached path.
    detail: {
      id: row.tmdbId,
      name: row.title,
      original_name: undefined,
      poster_path: row.posterPath,
      backdrop_path: null,
      overview: row.overview ?? "",
      release_date: undefined,
      first_air_date: row.firstAirDate ?? undefined,
      vote_average: 0,
      vote_count: 0,
      media_type: "tv",
      popularity: 0,
      original_language: row.originalLanguage ?? undefined,
      origin_country: row.originCountries ?? [],
      number_of_seasons: row.totalSeasons ?? 0,
      number_of_episodes: row.totalEpisodes ?? 0,
      seasons: Array.from({ length: row.seasonsCount ?? 0 }, (_, i) => ({
        id: row.tmdbId * 1000 + i + 1,
        name: `Season ${i + 1}`,
        season_number: i + 1,
        episode_count: 0,
        air_date: null,
        poster_path: null,
        overview: "",
      })),
      genres,
      tagline: "",
      status: row.tmdbStatus ?? "",
      episode_run_time: [],
      production_companies: [],
      production_countries: [],
      spoken_languages: [],
      homepage: null,
      in_production: row.inProduction ?? false,
      last_air_date: null,
      last_episode_to_air: null,
      next_episode_to_air: row.nextEpisodeAirDate
        ? {
            season_number: row.nextEpisodeSeasonNumber!,
            episode_number: row.nextEpisodeEpisodeNumber!,
            air_date: row.nextEpisodeAirDate!,
            name: row.nextEpisodeName,
          }
        : null,
      networks: [],
      created_by: [],
    } as unknown as TvDetail,
  };
}

/**
 * Serialize a TvStatusMetadata into the shape expected by Prisma's
 * TvMetadataCache.upsert create/update.
 */
function metadataToDbRow(meta: TvStatusMetadata, refreshAfter: Date) {
  return {
    tmdbId: meta.tmdbId,
    title: meta.title,
    posterPath: meta.posterPath,
    overview: meta.overview,
    firstAirDate: meta.firstAirDate,
    originalLanguage: meta.originalLanguage,
    originCountries: meta.originCountries,
    genreIds: meta.genres.map((genre) => genre.id),
    genreNames: meta.genres.map((genre) => genre.name),
    classificationComplete: meta.classificationComplete,
    tmdbStatus: meta.tmdbStatus,
    officiallyEnded: meta.officiallyEnded,
    inProduction: meta.inProduction,
    totalEpisodes: meta.totalEpisodes,
    totalSeasons: meta.totalSeasons,
    airedEpisodeCount: meta.airedEpisodeCount,
    airedEpisodeKeys: [...meta.airedEpisodeKeys],
    airedEpisodeInferenceReliable: meta.airedEpisodeInferenceReliable,
    nextEpisodeAirDate: meta.nextEpisode?.airDate ?? null,
    nextEpisodeName: meta.nextEpisode?.name ?? null,
    nextEpisodeSeasonNumber: meta.nextEpisode?.seasonNumber ?? null,
    nextEpisodeEpisodeNumber: meta.nextEpisode?.episodeNumber ?? null,
    seasonsCount: meta.detail.seasons?.length ?? null,
    lastSeasonNumber: meta.detail.seasons?.length
      ? Math.max(...meta.detail.seasons.map((s) => Number(s.season_number)).filter((n) => Number.isFinite(n) && n > 0), 0)
      : null,
    fetchedAt: new Date(),
    refreshAfter,
  };
}

/**
 * Read a fresh TvMetadataCache row from the DB. Returns null when the table
 * is missing (e.g. before the migration has been applied), when the row is
 * absent, or when the row is stale (refreshAfter has passed).
 *
 * "Stale" is defined per-show: ended shows refresh every 6h, ongoing shows
 * every 5m. Additionally, if a cached next-episode air date has become
 * current, we treat the row as stale so the engine re-evaluates the boundary.
 */
async function readDbMetadata(
  tmdbId: number,
  now: Date,
  requireClassification = false,
): Promise<TvStatusMetadata | null> {
  try {
    const row = await (db.tvMetadataCache as any).findUnique({ where: { tmdbId } }) as TvMetadataDbRow | null;
    if (!row) return null;
    if (requireClassification && !row.classificationComplete) return null;
    if (row.refreshAfter > now) {
      // Fresh enough. But check the next-episode boundary.
      if (row.nextEpisodeAirDate && isEpisodeReleased(row.nextEpisodeAirDate, now)) {
        return null; // stale — boundary crossed
      }
      return metadataFromDbRow(row);
    }
    return null; // stale
  } catch {
    // Table missing or query failed — fall back to TMDB. Don't crash the
    // whole request just because the cache table is unavailable.
    return null;
  }
}

/**
 * Batch-read TvMetadataCache rows from the DB. Returns a Map keyed by tmdbId
 * containing ONLY fresh rows. Stale or missing entries are omitted from the
 * result — callers must fall back to getTvStatusMetadata() for those ids.
 *
 * This is the critical performance primitive for /api/tv-tracking: instead
 * of 597 individual `findUnique` queries (one per tracked show), we issue
 * a single raw SQL query that returns all rows in one round-trip.
 *
 * Uses $queryRaw (not Prisma's findMany) because Prisma's type coercion on
 * 597 rows × 20 columns (including TEXT[] arrays with avg 63 elements each)
 * was measured at ~900ms. Raw SQL is ~150ms.
 *
 * By default the heavy `airedEpisodeKeys` TEXT[] column is omitted. Callers
 * may request it for every row with `includeEpisodeKeys`, or only for shows
 * that actually have watched progress with `episodeKeysForTmdbIds`. Ongoing
 * progress is deliberately unverified when the exact released-key boundary is
 * absent; it must never collapse to Not Started merely because a compact cache
 * projection skipped the array.
 */
export async function batchReadDbMetadata(
  tmdbIds: number[],
  now: Date,
  options: { includeEpisodeKeys?: boolean; episodeKeysForTmdbIds?: number[] } = {},
): Promise<Map<number, TvStatusMetadata>> {
  const result = new Map<number, TvStatusMetadata>();
  if (tmdbIds.length === 0) return result;
  const includeEpisodeKeys = options.includeEpisodeKeys === true;
  const requestedKeyIds = [...new Set((options.episodeKeysForTmdbIds ?? [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))];
  const episodeKeysProjection = includeEpisodeKeys
    ? Prisma.raw('"airedEpisodeKeys"')
    : requestedKeyIds.length > 0
      ? Prisma.raw(`CASE WHEN "tmdbId" IN (${requestedKeyIds.join(",")}) THEN "airedEpisodeKeys" ELSE ARRAY[]::TEXT[] END AS "airedEpisodeKeys"`)
      : Prisma.raw(`ARRAY[]::TEXT[] AS "airedEpisodeKeys"`);

  try {
    const rows = await db.$queryRaw<
      Array<{
        tmdbId: number;
        title: string;
        posterPath: string | null;
        overview: string | null;
        firstAirDate: string | null;
        originalLanguage: string | null;
        originCountries: string[];
        genreIds: number[];
        genreNames: string[];
        classificationComplete: boolean;
        tmdbStatus: string | null;
        officiallyEnded: boolean;
        inProduction: boolean | null;
        totalEpisodes: number | null;
        totalSeasons: number | null;
        airedEpisodeCount: number | null;
        airedEpisodeKeys: string[];
        airedEpisodeInferenceReliable: boolean;
        nextEpisodeAirDate: string | null;
        nextEpisodeName: string | null;
        nextEpisodeSeasonNumber: number | null;
        nextEpisodeEpisodeNumber: number | null;
        seasonsCount: number | null;
        lastSeasonNumber: number | null;
        refreshAfter: Date;
      }>
    >`
      SELECT
        "tmdbId", "title", "posterPath", "overview", "firstAirDate",
        "originalLanguage", "originCountries", "genreIds", "genreNames", "classificationComplete", "tmdbStatus",
        "officiallyEnded", "inProduction", "totalEpisodes", "totalSeasons",
        "airedEpisodeCount",
        ${episodeKeysProjection},
        "airedEpisodeInferenceReliable",
        "nextEpisodeAirDate", "nextEpisodeName", "nextEpisodeSeasonNumber", "nextEpisodeEpisodeNumber",
        "seasonsCount", "lastSeasonNumber", "refreshAfter"
      FROM "TvMetadataCache"
      WHERE "tmdbId" IN (${Prisma.join(tmdbIds)})
    `;
    for (const row of rows) {
      // Skip stale rows — the caller will fetch fresh data from TMDB.
      if (row.refreshAfter <= now) continue;
      // Skip rows whose next-episode boundary has just been crossed.
      if (row.nextEpisodeAirDate && isEpisodeReleased(row.nextEpisodeAirDate, now)) continue;
      result.set(row.tmdbId, metadataFromDbRow(row));
    }
  } catch (error) {
    // Table missing or query failed — return empty map. Caller falls back
    // to per-id getTvStatusMetadata() which in turn falls back to TMDB.
    console.warn("[tv-metadata-cache] batchReadDbMetadata failed", error);
  }
  return result;
}

/**
 * Upsert metadata before the request finishes. Cache failure remains non-fatal,
 * but a successful return now means the L2 write was allowed to settle instead
 * of being abandoned when a serverless invocation ends.
 */
async function writeDbMetadata(meta: TvStatusMetadata, refreshAfter: Date): Promise<void> {
  try {
    await (db.tvMetadataCache as any).upsert({
      where: { tmdbId: meta.tmdbId },
      create: metadataToDbRow(meta, refreshAfter),
      update: metadataToDbRow(meta, refreshAfter),
    });
  } catch (error) {
    console.warn(`[tv-metadata-cache] write failed for tmdbId=${meta.tmdbId}`, error);
  }
}

export async function getTvStatusMetadata(
  tmdbId: number,
  now: Date = new Date(),
  options: { requireClassification?: boolean } = {},
): Promise<TvStatusMetadata> {
  const id = Number(tmdbId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid TMDB TV id is required");

  // L1: in-memory cache (fast, but cold-start lossy)
  const requireClassification = options.requireClassification === true;
  const memCached = readFreshTvMetadata(tvMetadataCache.get(id), now, requireClassification);
  if (memCached) return memCached;

  // L2: DB cache (survives cold starts)
  const dbCached = await readDbMetadata(id, now, requireClassification);
  if (dbCached) {
    // Promote to L1 so subsequent reads in the same invocation skip the DB.
    tvMetadataCache.set(id, { value: dbCached, fetchedAt: Date.now() });
    return dbCached;
  }

  // L3: TMDB fetch (slow path)
  const detail = await tmdb.tvDetail(id);
  const inference = inferAiredEpisodesFromTvDetail(detail as any, now);
  const next: any = (detail as any).next_episode_to_air;
  const nextEpisode = next
    && Number(next.season_number) >= 1
    && Number(next.episode_number) >= 1
    && isFutureEpisode(next.air_date, now)
    ? {
        airDate: String(next.air_date),
        name: typeof next.name === "string" ? next.name : null,
        seasonNumber: Number(next.season_number),
        episodeNumber: Number(next.episode_number),
      }
    : null;

  const metadata: TvStatusMetadata = {
    tmdbId: id,
    title: detail.name || detail.original_name || `TV Show #${id}`,
    posterPath: detail.poster_path || null,
    overview: detail.overview || null,
    firstAirDate: detail.first_air_date || null,
    originalLanguage: detail.original_language?.trim().toLowerCase() || null,
    originCountries: [...new Set((detail.origin_country || []).map((country) => String(country).trim().toUpperCase()).filter(Boolean))],
    genres: (detail.genres || [])
      .map((genre) => ({ id: Number(genre.id || 0), name: String(genre.name || "").trim() }))
      .filter((genre) => genre.name.length > 0),
    classificationComplete: true,
    tmdbStatus: detail.status || null,
    officiallyEnded: isOfficiallyEndedTvStatus(detail.status),
    inProduction: typeof detail.in_production === "boolean" ? detail.in_production : null,
    totalEpisodes: Number.isFinite(Number(detail.number_of_episodes)) ? Number(detail.number_of_episodes) : null,
    totalSeasons: Number.isFinite(Number(detail.number_of_seasons)) ? Number(detail.number_of_seasons) : null,
    airedEpisodeCount: inference.airedEpisodeCount,
    airedEpisodeKeys: inference.airedEpisodeKeys,
    airedEpisodeInferenceReliable: inference.reliable,
    nextEpisode,
    detail,
  };

  // Populate both caches. The refresh-after timestamp depends on whether
  // the show has officially ended — ended shows rarely change, so 6h TTL;
  // ongoing shows get a 5m TTL so new episodes surface quickly.
  const ttlMs = metadata.officiallyEnded ? ENDED_TV_META_TTL_MS : ONGOING_TV_META_TTL_MS;
  const refreshAfter = new Date(now.getTime() + ttlMs);
  tvMetadataCache.set(id, { value: metadata, fetchedAt: Date.now() });
  await writeDbMetadata(metadata, refreshAfter);

  return metadata;
}

export async function getTvSeasonDetail(tmdbId: number, seasonNumber: number): Promise<SeasonDetail> {
  const key = `${Number(tmdbId)}:${Number(seasonNumber)}`;
  const cached = readFresh(seasonCache.get(key), SEASON_TTL_MS);
  if (cached) return cached;

  const detail = await tmdb.seasonDetail(Number(tmdbId), Number(seasonNumber));
  seasonCache.set(key, { value: detail, fetchedAt: Date.now() });
  return detail;
}

function episodeIsReleased(episode: Episode, officiallyEnded: boolean, now: Date): boolean {
  if (episode.season_number < 1 || episode.episode_number < 1) return false;
  if (isEpisodeReleased(episode.air_date, now)) return true;
  // Some old ended shows have missing episode air dates in TMDB. They are not
  // future episodes, so allow them only when the whole work is officially ended.
  return officiallyEnded && !episode.air_date;
}

export async function getReleasedEpisodesForSeason(
  tmdbId: number,
  seasonNumber: number,
  now: Date = new Date(),
  providedMetadata?: TvStatusMetadata,
): Promise<ReleasedEpisode[]> {
  const [metadata, season] = await Promise.all([
    providedMetadata ?? getTvStatusMetadata(tmdbId, now),
    getTvSeasonDetail(tmdbId, seasonNumber),
  ]);

  return (season.episodes || [])
    .filter((episode) => episodeIsReleased(episode, metadata.officiallyEnded, now))
    .map((episode) => ({
      seasonNumber: Number(episode.season_number),
      episodeNumber: Number(episode.episode_number),
      episodeName: episode.name || null,
      runtime: episode.runtime ?? null,
      airDate: episode.air_date || null,
    }));
}

export async function getAllReleasedEpisodes(
  tmdbId: number,
  now: Date = new Date(),
  providedMetadata?: TvStatusMetadata,
): Promise<ReleasedEpisode[]> {
  // A caller may provide today's metadata while asking for a historical
  // completion cutoff. This avoids caching date-dependent inference from an
  // old timestamp while still filtering each season at that exact cutoff.
  const metadata = providedMetadata ?? await getTvStatusMetadata(tmdbId, now);
  const seasonNumbers = (metadata.detail.seasons || [])
    .map((season) => Number(season.season_number))
    .filter((seasonNumber) => seasonNumber >= 1);

  const seasons = await Promise.all(
    seasonNumbers.map((seasonNumber) => getTvSeasonDetail(tmdbId, seasonNumber)),
  );

  const unique = new Map<string, ReleasedEpisode>();
  for (const season of seasons) {
    for (const episode of season.episodes || []) {
      if (!episodeIsReleased(episode, metadata.officiallyEnded, now)) continue;
      const item: ReleasedEpisode = {
        seasonNumber: Number(episode.season_number),
        episodeNumber: Number(episode.episode_number),
        episodeName: episode.name || null,
        runtime: episode.runtime ?? null,
        airDate: episode.air_date || null,
      };
      unique.set(episodeKey(item.seasonNumber, item.episodeNumber), item);
    }
  }

  return [...unique.values()].sort((a, b) =>
    a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
  );
}

export async function validateReleasedEpisodeBatch(
  tmdbId: number,
  episodes: TvEpisodeRequest[],
  now: Date = new Date(),
  providedMetadata?: TvStatusMetadata,
): Promise<{ released: ReleasedEpisode[]; blocked: TvEpisodeRequest[] }> {
  const seasonNumbers = [...new Set(episodes.map((episode) => Number(episode.seasonNumber)))];
  const releasedByKey = new Map<string, ReleasedEpisode>();

  const seasonResults = await Promise.all(
    seasonNumbers.map((seasonNumber) => getReleasedEpisodesForSeason(
      tmdbId,
      seasonNumber,
      now,
      providedMetadata,
    )),
  );
  for (const items of seasonResults) {
    for (const item of items) releasedByKey.set(episodeKey(item.seasonNumber, item.episodeNumber), item);
  }

  const released: ReleasedEpisode[] = [];
  const blocked: TvEpisodeRequest[] = [];
  for (const requested of episodes) {
    const match = releasedByKey.get(episodeKey(requested.seasonNumber, requested.episodeNumber));
    if (match) released.push(match);
    else blocked.push(requested);
  }
  return { released, blocked };
}

export type TvEpisodeRequest = {
  seasonNumber: number;
  episodeNumber: number;
  episodeName?: string | null;
};
