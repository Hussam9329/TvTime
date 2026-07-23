import type { ViewName } from "./navigation";

/**
 * The product navigation hierarchy is deliberately centralized so desktop,
 * mobile and QA all expose the same destinations in the same priority order.
 */
export const PRIMARY_NAV_VIEWS = [
  "home",
  "watch-next",
  "discover",
  "movies",
  "tv-shows",
  "anime",
] as const satisfies readonly ViewName[];

export const SECONDARY_NAV_VIEWS = [
  "stats",
  "arabic-movies",
  "arabic-tv",
] as const satisfies readonly ViewName[];

export const MOBILE_DOCK_VIEWS = [
  "home",
  "watch-next",
  "discover",
  "movies",
  "tv-shows",
] as const satisfies readonly ViewName[];

export const DETAIL_VIEWS = [
  "movie-detail",
  "tv-detail",
  "person-detail",
] as const satisfies readonly ViewName[];

export function isDetailView(view: ViewName): boolean {
  return DETAIL_VIEWS.some((candidate) => candidate === view);
}

export function isMobileDockView(view: ViewName): boolean {
  return MOBILE_DOCK_VIEWS.some((candidate) => candidate === view);
}
