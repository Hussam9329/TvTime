type UpcomingEpisode = {
  airDate: string;
  seasonNumber: number;
  episodeNumber: number;
};

type SeasonEpisode = {
  season_number?: number;
  episode_number?: number;
};

function dateParts(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function safeTimeZone(timeZone?: string | null): string {
  const candidate = String(timeZone || "Asia/Baghdad");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "Asia/Baghdad";
  }
}

export function notificationAlertDates(now: Date, timeZone?: string | null): Set<string> {
  const zone = safeTimeZone(timeZone);
  const dates = new Set([dateParts(now, zone)]);
  // Walk in small increments so a daylight-saving transition cannot make a
  // fixed +24 hours land on the same local calendar date.
  for (let hours = 6; hours <= 48 && dates.size < 2; hours += 6) {
    dates.add(dateParts(new Date(now.getTime() + hours * 60 * 60 * 1000), zone));
  }
  return dates;
}

export function isUpcomingSeasonAlert(
  episode: UpcomingEpisode | null | undefined,
  now: Date,
  timeZone?: string | null,
): episode is UpcomingEpisode {
  return Boolean(
    episode
      && /^\d{4}-\d{2}-\d{2}$/.test(episode.airDate)
      && episode.seasonNumber >= 1
      && episode.episodeNumber >= 1
      && notificationAlertDates(now, timeZone).has(episode.airDate),
  );
}

export function isSeasonPremiere(episode: UpcomingEpisode): boolean {
  return episode.seasonNumber >= 1 && episode.episodeNumber === 1;
}

export function isSeasonFinale(episode: UpcomingEpisode, episodes: SeasonEpisode[]): boolean {
  if (episode.seasonNumber < 1 || episode.episodeNumber <= 1) return false;
  const regularEpisodeNumbers = episodes
    .filter((item) => Number(item.season_number) === episode.seasonNumber)
    .map((item) => Number(item.episode_number))
    .filter((number) => Number.isInteger(number) && number >= 1);
  return regularEpisodeNumbers.length > 0
    && episode.episodeNumber === Math.max(...regularEpisodeNumbers);
}

export function scheduledAirDate(airDate: string): Date {
  return new Date(`${airDate}T12:00:00.000Z`);
}

export function formatAirDate(airDate: string, timeZone?: string | null): string {
  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(scheduledAirDate(airDate));
}
