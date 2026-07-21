export const TVTIME_SEARCH_FOCUS_EVENT = "tvtime:search-focus";
export const TVTIME_SEARCH_CLOSE_EVENT = "tvtime:search-close";

export function requestSearchFocus(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TVTIME_SEARCH_FOCUS_EVENT));
}

export function requestSearchClose(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TVTIME_SEARCH_CLOSE_EVENT));
}
