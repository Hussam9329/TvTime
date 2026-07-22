export type ViewName =
  | "home"
  | "watch-next"
  | "discover"
  | "search"
  | "movie-detail"
  | "tv-detail"
  | "person-detail"
  | "movies"
  | "anime"
  | "stats"
  | "tv-shows"
  | "arabic-movies"
  | "arabic-tv";

export type NavigationEntry = {
  view: ViewName;
  movieId: number | null;
  tvId: number | null;
  personId: number | null;
};

const ROOT_VIEWS = new Set<ViewName>([
  "home",
  "watch-next",
  "discover",
  "search",
  "movies",
  "anime",
  "stats",
  "tv-shows",
  "arabic-movies",
  "arabic-tv",
]);

export const HOME_NAVIGATION_ENTRY: NavigationEntry = {
  view: "home",
  movieId: null,
  tvId: null,
  personId: null,
};

function positiveInteger(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeNavigationEntry(entry: Partial<NavigationEntry>): NavigationEntry {
  const view = entry.view && (ROOT_VIEWS.has(entry.view) || ["movie-detail", "tv-detail", "person-detail"].includes(entry.view))
    ? entry.view
    : "home";

  if (view === "movie-detail") {
    const movieId = positiveInteger(entry.movieId);
    return movieId ? { view, movieId, tvId: null, personId: null } : HOME_NAVIGATION_ENTRY;
  }
  if (view === "tv-detail") {
    const tvId = positiveInteger(entry.tvId);
    return tvId ? { view, movieId: null, tvId, personId: null } : HOME_NAVIGATION_ENTRY;
  }
  if (view === "person-detail") {
    const personId = positiveInteger(entry.personId);
    return personId ? { view, movieId: null, tvId: null, personId } : HOME_NAVIGATION_ENTRY;
  }

  return { view, movieId: null, tvId: null, personId: null };
}

export function navigationEntryToHref(entry: NavigationEntry): string {
  const normalized = normalizeNavigationEntry(entry);
  if (normalized.view === "movie-detail") return `/movie/${normalized.movieId}`;
  if (normalized.view === "tv-detail") return `/tv/${normalized.tvId}`;
  if (normalized.view === "person-detail") return `/person/${normalized.personId}`;
  if (normalized.view === "arabic-movies") return "/arabic/movies";
  if (normalized.view === "arabic-tv") return "/arabic/tv";
  if (normalized.view === "home") return "/";
  return `/?view=${encodeURIComponent(normalized.view)}`;
}

export function navigationEntryFromPath(pathname: string, search = ""): NavigationEntry {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/arabic/movies") {
    return { view: "arabic-movies", movieId: null, tvId: null, personId: null };
  }
  if (cleanPath === "/arabic/tv") {
    return { view: "arabic-tv", movieId: null, tvId: null, personId: null };
  }

  const detailMatch = /^\/(movie|tv|person)\/(\d+)$/.exec(cleanPath);
  if (detailMatch) {
    const id = positiveInteger(detailMatch[2]);
    if (!id) return HOME_NAVIGATION_ENTRY;
    if (detailMatch[1] === "movie") return { view: "movie-detail", movieId: id, tvId: null, personId: null };
    if (detailMatch[1] === "tv") return { view: "tv-detail", movieId: null, tvId: id, personId: null };
    return { view: "person-detail", movieId: null, tvId: null, personId: id };
  }

  const viewParam = new URLSearchParams(search).get("view") as ViewName | null;
  if (viewParam && ROOT_VIEWS.has(viewParam)) {
    return { view: viewParam, movieId: null, tvId: null, personId: null };
  }
  return HOME_NAVIGATION_ENTRY;
}

export function navigationEntryFromView(view: ViewName): NavigationEntry {
  if (!ROOT_VIEWS.has(view)) return HOME_NAVIGATION_ENTRY;
  return { view, movieId: null, tvId: null, personId: null };
}

export function sameNavigationEntry(a: NavigationEntry, b: NavigationEntry): boolean {
  return a.view === b.view
    && a.movieId === b.movieId
    && a.tvId === b.tvId
    && a.personId === b.personId;
}
