import { tmdb, type Episode, type SeasonDetail, type TvDetail } from "@/lib/tmdb";
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

const tvMetadataCache = new Map<number, CacheEntry<TvStatusMetadata>>();
const seasonCache = new Map<string, CacheEntry<SeasonDetail>>();

function readFresh<T>(entry: CacheEntry<T> | undefined, ttl: number): T | null {
  if (!entry) return null;
  return Date.now() - entry.fetchedAt < ttl ? entry.value : null;
}

function readFreshTvMetadata(entry: CacheEntry<TvStatusMetadata> | undefined, now: Date): TvStatusMetadata | null {
  if (!entry) return null;
  const ttl = entry.value.officiallyEnded ? ENDED_TV_META_TTL_MS : ONGOING_TV_META_TTL_MS;
  const cached = readFresh(entry, ttl);
  if (!cached) return null;

  // Do not let the ordinary metadata TTL hide an episode whose calendar date
  // has just arrived. TMDB only supplies an air date here, so the state engine
  // must refresh the boundary as soon as that date becomes current.
  if (cached.nextEpisode?.airDate && isEpisodeReleased(cached.nextEpisode.airDate, now)) {
    return null;
  }
  return cached;
}

export async function getTvStatusMetadata(tmdbId: number, now: Date = new Date()): Promise<TvStatusMetadata> {
  const id = Number(tmdbId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("A valid TMDB TV id is required");

  const cached = readFreshTvMetadata(tvMetadataCache.get(id), now);
  if (cached) return cached;

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

  tvMetadataCache.set(id, { value: metadata, fetchedAt: Date.now() });
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
): Promise<ReleasedEpisode[]> {
  const [metadata, season] = await Promise.all([
    getTvStatusMetadata(tmdbId, now),
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
): Promise<{ released: ReleasedEpisode[]; blocked: TvEpisodeRequest[] }> {
  const seasonNumbers = [...new Set(episodes.map((episode) => Number(episode.seasonNumber)))];
  const releasedByKey = new Map<string, ReleasedEpisode>();

  const seasonResults = await Promise.all(
    seasonNumbers.map((seasonNumber) => getReleasedEpisodesForSeason(tmdbId, seasonNumber, now)),
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
