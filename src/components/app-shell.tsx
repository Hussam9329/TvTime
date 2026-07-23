"use client";

import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNav, getBrowserNavigationIndex, initializeBrowserNavigation } from "@/lib/store";
import { navigationEntryFromPath, normalizeNavigationEntry, type NavigationEntry } from "@/lib/navigation";
import { getViewMetadata } from "@/lib/view-metadata";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeView } from "@/components/views/home-view";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { ErrorBoundary } from "@/components/error-boundary";

// Lazy-load secondary views so the initial bundle only contains HomeView +
// shared layout. Each view is fetched on first navigation, then cached by
// the browser. This drops the initial JS payload from ~1.6MB to ~400KB.
const DiscoverView = lazy(() =>
  import("@/components/views/discover-view").then((m) => ({ default: m.DiscoverView })),
);
const WatchNextView = lazy(() =>
  import("@/components/views/watch-next-view").then((m) => ({ default: m.WatchNextView })),
);
const SearchView = lazy(() =>
  import("@/components/views/search-view").then((m) => ({ default: m.SearchView })),
);
const MovieDetailView = lazy(() =>
  import("@/components/views/movie-detail-view").then((m) => ({ default: m.MovieDetailView })),
);
const TvDetailView = lazy(() =>
  import("@/components/views/tv-detail-view").then((m) => ({ default: m.TvDetailView })),
);
const PersonDetailView = lazy(() =>
  import("@/components/views/person-detail-view").then((m) => ({ default: m.PersonDetailView })),
);
const MoviesView = lazy(() =>
  import("@/components/views/movies-view").then((m) => ({ default: m.MoviesView })),
);
const AnimeView = lazy(() =>
  import("@/components/views/anime-view").then((m) => ({ default: m.AnimeView })),
);
const StatsView = lazy(() =>
  import("@/components/views/stats-view").then((m) => ({ default: m.StatsView })),
);
const TvShowsView = lazy(() =>
  import("@/components/views/tv-shows-page-view").then((m) => ({ default: m.TVShowsPageView })),
);
const ArabicMoviesView = lazy(() =>
  import("@/components/views/arabic-movies-view").then((m) => ({ default: m.ArabicMoviesView })),
);
const ArabicTvView = lazy(() =>
  import("@/components/views/arabic-tv-view").then((m) => ({ default: m.ArabicTvView })),
);

function ViewSkeleton() {
  // Mirrors the layout of detail pages and grid views so the first paint
  // is visually stable while the chunk loads.
  return (
    <div
      className="feedback-state feedback-state--loading space-y-5 py-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading page content"
      role="status"
    >
      <span className="sr-only">Loading page content…</span>
      <div aria-hidden="true" className="h-8 w-full max-w-sm shimmer rounded-lg" />
      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] shimmer rounded-xl border border-border/40" />
        ))}
      </div>
    </div>
  );
}

export function AppShell({ initialRoute }: { initialRoute: NavigationEntry }) {
  const normalizedInitialRoute = useMemo(
    () => normalizeNavigationEntry(initialRoute),
    [initialRoute.view, initialRoute.movieId, initialRoute.tvId, initialRoute.personId],
  );
  const view = useNav((state) => state.view);
  const movieId = useNav((state) => state.movieId);
  const tvId = useNav((state) => state.tvId);
  const personId = useNav((state) => state.personId);
  const syncRoute = useNav((state) => state.syncRoute);
  const routeReady = useNav((state) => state.routeReady);
  const mainRef = useRef<HTMLElement>(null);
  const hasMountedRoute = useRef(false);
  const [routeAnnouncement, setRouteAnnouncement] = useState("");

  const viewMetadata = getViewMetadata(view);
  const routeKey = `${view}-${movieId ?? ""}-${tvId ?? ""}-${personId ?? ""}`;

  useLayoutEffect(() => {
    const navigationIndex = initializeBrowserNavigation(normalizedInitialRoute);
    syncRoute(normalizedInitialRoute, "reset", navigationIndex);
  }, [normalizedInitialRoute, syncRoute]);

  useEffect(() => {
    const onPopState = () => {
      const route = navigationEntryFromPath(window.location.pathname, window.location.search);
      syncRoute(route, "pop", getBrowserNavigationIndex());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [syncRoute]);

  useEffect(() => {
    if (!routeReady) return;

    window.scrollTo({ top: 0, behavior: "auto" });

    // Do not move focus during the initial hydration. After an in-app route
    // change, focus the new main region and announce it like a real page load.
    if (!hasMountedRoute.current) {
      hasMountedRoute.current = true;
      return;
    }

    setRouteAnnouncement(viewMetadata.announcement);
    const frame = window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey, routeReady, viewMetadata.announcement]);

  if (!routeReady) {
    return (
      <div
        className="min-h-dvh bg-background"
        aria-busy="true"
        aria-label="Loading application"
        role="status"
      />
    );
  }

  return (
    <div className="tvtime-app min-h-dvh flex flex-col">
      <a href="#tvtime-main-content" className="tvtime-skip-link">
        Skip to main content
      </a>

      <div
        className="sr-only"
        aria-atomic="true"
        aria-live="polite"
        dir={viewMetadata.direction}
        lang={viewMetadata.language}
      >
        {routeAnnouncement}
      </div>

      <Header />
      <KeyboardShortcuts />

      <main
        ref={mainRef}
        id="tvtime-main-content"
        tabIndex={-1}
        lang={viewMetadata.language}
        dir={viewMetadata.direction}
        aria-label={viewMetadata.accessibleLabel}
        className="tvtime-main-content flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6"
      >
        <div key={routeKey} className="animate-fade-in-up">
          {/* HomeView stays eager — it is the landing page and the first thing
              the user sees after login. */}
          {view === "home" && (
            <ErrorBoundary>
              <HomeView />
            </ErrorBoundary>
          )}

          {/* All other views are code-split. Suspense falls back to a
              skeleton so the user sees structure immediately. ErrorBoundary
              catches runtime errors so a single broken view doesn't crash
              the whole app. */}
          {view !== "home" && (
            <ErrorBoundary>
              <Suspense fallback={<ViewSkeleton />}>
                {view === "discover" && <DiscoverView />}
                {view === "watch-next" && <WatchNextView />}
                {view === "search" && <SearchView />}
                {view === "movie-detail" && movieId && <MovieDetailView />}
                {view === "tv-detail" && tvId && <TvDetailView />}
                {view === "person-detail" && personId && <PersonDetailView />}
                {view === "movies" && <MoviesView />}
                {view === "anime" && <AnimeView />}
                {view === "stats" && <StatsView />}
                {view === "tv-shows" && <TvShowsView />}
                {view === "arabic-movies" && <ArabicMoviesView />}
                {view === "arabic-tv" && <ArabicTvView />}
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
