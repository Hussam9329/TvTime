/**
 * Single source of truth for "this TV title has been started/seen".
 *
 * This set is intentionally shared by every surface that reasons about seen
 * vs. unseen shows: the Home hero filter, the Anime hub, Discover's seen /
 * unseen filters (client + SQL predicate). A previous per-file duplication
 * disagreed on "stopped" — Home and Anime treated a stopped show as seen
 * while Discover kept recommending it as unseen. "stopped" means the user
 * watched part of the show, so it belongs in the seen set everywhere.
 *
 * "up_to_date" is kept alongside "uptodate" as a legacy alias.
 */
export const TV_STARTED_STATUS_VALUES = [
  "watching",
  "uptodate",
  "up_to_date",
  "finished",
  "watched",
  "stopped",
] as const;

export const TV_STARTED_STATUSES: ReadonlySet<string> = new Set(TV_STARTED_STATUS_VALUES);
