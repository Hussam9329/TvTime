import type { ViewName } from "./navigation";

export type ViewDirection = "ltr" | "rtl";
export type ViewLanguage = "en" | "ar";

export type ViewMetadata = {
  label: string;
  accessibleLabel: string;
  announcement: string;
  language: ViewLanguage;
  direction: ViewDirection;
};

const ENGLISH_VIEW = {
  language: "en",
  direction: "ltr",
} as const;

const ARABIC_VIEW = {
  language: "ar",
  direction: "rtl",
} as const;

/**
 * Shared view metadata keeps visible navigation, route announcements, and
 * content direction in sync. The application chrome remains LTR while Arabic
 * catalogue content is scoped to RTL inside <main>.
 */
export const VIEW_METADATA: Record<ViewName, ViewMetadata> = {
  home: {
    label: "Home",
    accessibleLabel: "Home",
    announcement: "Home loaded",
    ...ENGLISH_VIEW,
  },
  "watch-next": {
    label: "Watch Next",
    accessibleLabel: "Watch Next",
    announcement: "Watch Next loaded",
    ...ENGLISH_VIEW,
  },
  discover: {
    label: "Discover",
    accessibleLabel: "Discover",
    announcement: "Discover loaded",
    ...ENGLISH_VIEW,
  },
  search: {
    label: "Search",
    accessibleLabel: "Search",
    announcement: "Search loaded",
    ...ENGLISH_VIEW,
  },
  "movie-detail": {
    label: "Movie Details",
    accessibleLabel: "Movie details",
    announcement: "Movie details loaded",
    ...ENGLISH_VIEW,
  },
  "tv-detail": {
    label: "TV Details",
    accessibleLabel: "TV show details",
    announcement: "TV show details loaded",
    ...ENGLISH_VIEW,
  },
  "person-detail": {
    label: "Person Details",
    accessibleLabel: "Person details",
    announcement: "Person details loaded",
    ...ENGLISH_VIEW,
  },
  movies: {
    label: "Movies",
    accessibleLabel: "Movies",
    announcement: "Movies loaded",
    ...ENGLISH_VIEW,
  },
  anime: {
    label: "Anime",
    accessibleLabel: "Anime",
    announcement: "Anime loaded",
    ...ENGLISH_VIEW,
  },
  stats: {
    label: "Stats",
    accessibleLabel: "Viewing statistics",
    announcement: "Viewing statistics loaded",
    ...ENGLISH_VIEW,
  },
  "tv-shows": {
    label: "TV Shows",
    accessibleLabel: "TV Shows",
    announcement: "TV Shows loaded",
    ...ENGLISH_VIEW,
  },
  "arabic-movies": {
    label: "Arabic Movies",
    accessibleLabel: "الأفلام العربية",
    announcement: "تم تحميل صفحة الأفلام العربية",
    ...ARABIC_VIEW,
  },
  "arabic-tv": {
    label: "Arabic TV",
    accessibleLabel: "المسلسلات العربية",
    announcement: "تم تحميل صفحة المسلسلات العربية",
    ...ARABIC_VIEW,
  },
};

export function getViewMetadata(view: ViewName): ViewMetadata {
  return VIEW_METADATA[view];
}

export function getViewLabel(view: ViewName): string {
  return VIEW_METADATA[view].label;
}

export function isArabicView(view: ViewName): boolean {
  return VIEW_METADATA[view].direction === "rtl";
}
