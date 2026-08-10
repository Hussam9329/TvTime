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
import { MotionConfig } from "framer-motion";

const MAX_SAVED_SCROLL_ENTRIES = 50;

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
const AsianTvView = lazy(() =>
  import("@/components/views/asian-tv-view").then((m) => ({ default: m.AsianTvView })),
);
const AsianMoviesView = lazy(() =>
  import("@/components/views/asian-movies-view").then((m) => ({ default: m.AsianMoviesView })),
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
  const storedView = useNav((state) => state.view);
  const storedMovieId = useNav((state) => state.movieId);
  const storedTvId = useNav((state) => state.tvId);
  const storedPersonId = useNav((state) => state.personId);
  const syncRoute = useNav((state) => state.syncRoute);
  const routeReady = useNav((state) => state.routeReady);
  const navigationIndex = useNav((state) => state.navigationIndex);
  const mainRef = useRef<HTMLElement>(null);
  const hasMountedRoute = useRef(false);
  const activeNavigationIndex = useRef(navigationIndex);
  const pendingPopIndex = useRef<number | null>(null);
  const scrollPositions = useRef(new Map<number, number>());
  const [routeAnnouncement, setRouteAnnouncement] = useState("");

  // The server and the first client render use the route parsed by the page.
  // Zustand is synchronized in the layout effect below, before the browser
  // paints. This keeps hydration deterministic without withholding the whole
  // application behind an empty routeReady screen.
  const view = routeReady ? storedView : normalizedInitialRoute.view;
  const movieId = routeReady ? storedMovieId : normalizedInitialRoute.movieId;
  const tvId = routeReady ? storedTvId : normalizedInitialRoute.tvId;
  const personId = routeReady ? storedPersonId : normalizedInitialRoute.personId;

  const viewMetadata = getViewMetadata(view);
  const routeKey = `${view}-${movieId ?? ""}-${tvId ?? ""}-${personId ?? ""}`;

  useLayoutEffect(() => {
    const navigationIndex = initializeBrowserNavigation(normalizedInitialRoute);
    syncRoute(normalizedInitialRoute, "reset", navigationIndex);
  }, [normalizedInitialRoute, syncRoute]);

  useLayoutEffect(() => {
    activeNavigationIndex.current = navigationIndex;
  }, [navigationIndex]);

  useEffect(() => {
    const onPopState = () => {
      const route = navigationEntryFromPath(window.location.pathname, window.location.search);
      const browserIndex = getBrowserNavigationIndex();
      pendingPopIndex.current = browserIndex ?? navigationIndex;
      syncRoute(route, "pop", browserIndex);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigationIndex, syncRoute]);

  useEffect(() => {
    let scrollFrame: number | null = null;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const saveScrollPosition = () => {
      scrollFrame = null;
      const index = activeNavigationIndex.current;
      scrollPositions.current.delete(index);
      scrollPositions.current.set(index, window.scrollY);
      while (scrollPositions.current.size > MAX_SAVED_SCROLL_ENTRIES) {
        const oldestIndex = scrollPositions.current.keys().next().value;
        if (oldestIndex == null) break;
        scrollPositions.current.delete(oldestIndex);
      }
    };
    const onScroll = () => {
      if (scrollFrame == null) scrollFrame = window.requestAnimationFrame(saveScrollPosition);
    };

    saveScrollPosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.history.scrollRestoration = previousScrollRestoration;
      if (scrollFrame != null) window.cancelAnimationFrame(scrollFrame);
      saveScrollPosition();
    };
  }, []);

  useEffect(() => {
    if (!routeReady) return;

    // Do not move focus during the initial hydration. After an in-app route
    // change, focus the new main region and announce it like a real page load.
    // Initial browser restoration is also left untouched.
    if (!hasMountedRoute.current) {
      hasMountedRoute.current = true;
      return;
    }

    let restoreFrame: number | null = null;
    const popIndex = pendingPopIndex.current;
    pendingPopIndex.current = null;

    if (popIndex === navigationIndex) {
      const savedTop = scrollPositions.current.get(navigationIndex);
      if (savedTop != null) {
        let attempts = 0;
        const restore = () => {
          attempts += 1;
          window.scrollTo({ top: savedTop, behavior: "auto" });
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          const targetIsAvailable = maxScroll >= savedTop - 1;
          const targetWasRestored = Math.abs(window.scrollY - savedTop) <= 1;
          if ((!targetIsAvailable || !targetWasRestored) && attempts < 60) {
            restoreFrame = window.requestAnimationFrame(restore);
          }
        };
        restoreFrame = window.requestAnimationFrame(restore);
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    setRouteAnnouncement(viewMetadata.announcement);
    const focusFrame = window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (restoreFrame != null) window.cancelAnimationFrame(restoreFrame);
    };
  }, [navigationIndex, routeKey, routeReady, viewMetadata.announcement]);

  return (
    <MotionConfig reducedMotion="user">
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
          className="tvtime-main-content flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6"
        >
          <div key={routeKey} className="tvtime-view-transition animate-fade-in-up">
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
                {view === "asian-tv" && <AsianTvView />}
                {view === "asian-movies" && <AsianMoviesView />}
                {view === "arabic-movies" && <ArabicMoviesView />}
                {view === "arabic-tv" && <ArabicTvView />}
              </Suspense>
            </ErrorBoundary>
          )}
          </div>
        </main>

        <Footer />
      </div>
    </MotionConfig>
  );
}
