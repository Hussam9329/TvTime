export type WatchEpisodeRef = {
  seasonNumber: number;
  episodeNumber: number;
  episodeName?: string | null;
};

export type EpisodeWatchPlan = {
  kind: "episode" | "season";
  targetLabel: string;
  selectedEpisodes: WatchEpisodeRef[];
  previousUnwatched: WatchEpisodeRef[];
  allEpisodes: WatchEpisodeRef[];
  previousSeasonCount: number;
};

function episodeKey(episode: Pick<WatchEpisodeRef, "seasonNumber" | "episodeNumber">) {
  return `${episode.seasonNumber}-${episode.episodeNumber}`;
}

function compareEpisodePosition(a: WatchEpisodeRef, b: WatchEpisodeRef) {
  return a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;
}

function normalizeEpisodes(episodes: WatchEpisodeRef[]) {
  const unique = new Map<string, WatchEpisodeRef>();
  for (const episode of episodes) {
    if (!Number.isInteger(episode.seasonNumber) || episode.seasonNumber < 1) continue;
    if (!Number.isInteger(episode.episodeNumber) || episode.episodeNumber < 1) continue;
    unique.set(episodeKey(episode), {
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeName: episode.episodeName || undefined,
    });
  }
  return [...unique.values()].sort(compareEpisodePosition);
}

function summarizePlan(
  kind: EpisodeWatchPlan["kind"],
  targetLabel: string,
  selectedEpisodes: WatchEpisodeRef[],
  previousUnwatched: WatchEpisodeRef[],
): EpisodeWatchPlan {
  const selected = normalizeEpisodes(selectedEpisodes);
  const previous = normalizeEpisodes(previousUnwatched);
  return {
    kind,
    targetLabel,
    selectedEpisodes: selected,
    previousUnwatched: previous,
    allEpisodes: normalizeEpisodes([...previous, ...selected]),
    previousSeasonCount: new Set(previous.map((episode) => episode.seasonNumber)).size,
  };
}

export function buildEpisodeWatchPlan(args: {
  target: WatchEpisodeRef;
  releasedEpisodes: WatchEpisodeRef[];
  watchedKeys: ReadonlySet<string>;
}): EpisodeWatchPlan {
  const target = normalizeEpisodes([args.target])[0];
  if (!target) {
    return summarizePlan("episode", "this episode", [], []);
  }

  const previousUnwatched = normalizeEpisodes(args.releasedEpisodes).filter((episode) => (
    compareEpisodePosition(episode, target) < 0
    && !args.watchedKeys.has(episodeKey(episode))
  ));

  return summarizePlan(
    "episode",
    `S${target.seasonNumber}E${target.episodeNumber}`,
    args.watchedKeys.has(episodeKey(target)) ? [] : [target],
    previousUnwatched,
  );
}

export function buildSeasonWatchPlan(args: {
  seasonNumber: number;
  releasedEpisodes: WatchEpisodeRef[];
  watchedKeys: ReadonlySet<string>;
}): EpisodeWatchPlan {
  const timeline = normalizeEpisodes(args.releasedEpisodes);
  const selectedEpisodes = timeline.filter((episode) => (
    episode.seasonNumber === args.seasonNumber
    && !args.watchedKeys.has(episodeKey(episode))
  ));
  const previousUnwatched = timeline.filter((episode) => (
    episode.seasonNumber < args.seasonNumber
    && !args.watchedKeys.has(episodeKey(episode))
  ));

  return summarizePlan(
    "season",
    `Season ${args.seasonNumber}`,
    selectedEpisodes,
    previousUnwatched,
  );
}

export function progressEpisodesToWatchRefs(
  episodes: Array<{
    seasonNumber: number;
    episode: { episode_number: number; name?: string | null };
  }>,
): WatchEpisodeRef[] {
  return episodes.map(({ seasonNumber, episode }) => ({
    seasonNumber,
    episodeNumber: episode.episode_number,
    episodeName: episode.name || undefined,
  }));
}
