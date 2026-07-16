export type EpisodeRatingIdentity = {
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
};

const EPISODE_RATING_PREFIX = "episode:";

export function episodeRatingMediaType(seasonNumber: number, episodeNumber: number): string {
  const season = Number(seasonNumber);
  const episode = Number(episodeNumber);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) {
    throw new Error("A valid regular episode is required");
  }
  return `${EPISODE_RATING_PREFIX}${season}:${episode}`;
}

export function parseEpisodeRatingMediaType(mediaType?: string | null): Pick<EpisodeRatingIdentity, "seasonNumber" | "episodeNumber"> | null {
  const match = /^episode:(\d+):(\d+)$/.exec(String(mediaType || ""));
  if (!match) return null;
  const seasonNumber = Number(match[1]);
  const episodeNumber = Number(match[2]);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return null;
  }
  return { seasonNumber, episodeNumber };
}

export function isEpisodeRatingMediaType(mediaType?: string | null): boolean {
  return parseEpisodeRatingMediaType(mediaType) !== null;
}

export function episodeRatingKey(seasonNumber: number, episodeNumber: number): string {
  return `${Number(seasonNumber)}-${Number(episodeNumber)}`;
}

export function clampRatingOutOf100(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error("A numeric rating is required");
  return Math.max(0, Math.min(100, Math.round(numeric)));
}
