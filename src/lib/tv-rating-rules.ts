/**
 * Pure whole-series rating rule. A title-level TV rating is valid only after
 * the work has officially ended and every final regular episode is watched.
 */
export function isWholeSeriesRatingEligible(args: {
  officiallyEnded: boolean;
  totalEpisodes: number;
  watchedEpisodes: number;
}): boolean {
  return args.officiallyEnded === true
    && Number.isFinite(args.totalEpisodes)
    && args.totalEpisodes > 0
    && args.watchedEpisodes >= args.totalEpisodes;
}
