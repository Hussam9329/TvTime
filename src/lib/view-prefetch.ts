import type { ViewName } from "@/lib/navigation";

const warmedViews = new Set<ViewName>();

/**
 * Warm the code-split chunk before navigation. Header links call this on
 * pointer hover and keyboard focus, so the view is usually already in the
 * browser cache by the time it is selected.
 */
export function prefetchViewModule(view: ViewName) {
  if (typeof window === "undefined" || warmedViews.has(view)) return;
  warmedViews.add(view);

  let request: Promise<unknown> | undefined;
  switch (view) {
    case "discover":
      request = import("@/components/views/discover-view");
      break;
    case "watch-next":
      request = import("@/components/views/watch-next-view");
      break;
    case "search":
      request = import("@/components/views/search-view");
      break;
    case "movies":
      request = import("@/components/views/movies-view");
      break;
    case "tv-shows":
      request = import("@/components/views/tv-tracking-view");
      break;
    case "anime":
      request = import("@/components/views/anime-view");
      break;
    case "stats":
      request = import("@/components/views/stats-view");
      break;
    case "arabic-movies":
      request = import("@/components/views/arabic-movies-view");
      break;
    case "arabic-tv":
      request = import("@/components/views/arabic-tv-view");
      break;
    default:
      return;
  }

  void request.catch(() => {
    // A transient chunk failure should be retryable on the next interaction.
    warmedViews.delete(view);
  });
}
