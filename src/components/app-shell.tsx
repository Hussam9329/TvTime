"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { useNav, getBrowserNavigationIndex, initializeBrowserNavigation } from "@/lib/store";
import { navigationEntryFromPath, normalizeNavigationEntry, type NavigationEntry } from "@/lib/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeView } from "@/components/views/home-view";
import { DiscoverView } from "@/components/views/discover-view";
import { SearchView } from "@/components/views/search-view";
import { MovieDetailView } from "@/components/views/movie-detail-view";
import { TvDetailView } from "@/components/views/tv-detail-view";
import { PersonDetailView } from "@/components/views/person-detail-view";
import { CalendarView } from "@/components/views/calendar-view";
import { MoviesView } from "@/components/views/movies-view";
import { AnimeView } from "@/components/views/anime-view";
import { StatsView } from "@/components/views/stats-view";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { MediaView } from "@/components/views/media-view";
import { ArabicMoviesView } from "@/components/views/arabic-movies-view";
import { ArabicTvView } from "@/components/views/arabic-tv-view";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";

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
    if (routeReady) window.scrollTo({ top: 0, behavior: "auto" });
  }, [routeReady, view, movieId, tvId, personId]);

  if (!routeReady) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <KeyboardShortcuts />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div key={`${view}-${movieId ?? ""}-${tvId ?? ""}-${personId ?? ""}`} className="animate-fade-in-up">
          {view === "home" && <HomeView />}
          {view === "discover" && <DiscoverView />}
          {view === "search" && <SearchView />}
          {view === "movie-detail" && movieId && <MovieDetailView />}
          {view === "tv-detail" && tvId && <TvDetailView />}
          {view === "person-detail" && personId && <PersonDetailView />}
          {view === "calendar" && <CalendarView />}
          {view === "movies" && <MoviesView />}
          {view === "anime" && <AnimeView />}
          {view === "stats" && <StatsView />}
          {view === "media" && <MediaView />}
          {view === "tv-shows" && <TvShowsView />}
          {view === "arabic-movies" && <ArabicMoviesView />}
          {view === "arabic-tv" && <ArabicTvView />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
